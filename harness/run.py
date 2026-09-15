"""RequestBench orchestrator: boot, gate, warm, ladder, record, tear down.

  python3 harness/run.py --targets node:node-http,node:fastify,node:express
  python3 harness/run.py --targets node:fastify --seconds 20 --rungs 3,5
"""
import argparse, collections, functools, http.client, json, os, pathlib, platform, re, shutil, signal, socket, subprocess, sys, time, uuid

import bundle
import machine
from bundle import target_dir

# Long runs are watched live; block-buffered stdout hides progress for minutes.
print = functools.partial(print, flush=True)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
LADDER = json.loads((SPEC / "ladder.json").read_text())
MATRIX = json.loads((SPEC / "matrix.json").read_text())
# The endpoint set a run measured, carried on every row it writes. Hardcoding it meant a
# blend-v2 run filed itself as blend-v1 and landed in the same time series as one.
BLEND = json.loads((SPEC / "endpoints.json").read_text())["version"]
# And which rates those endpoints were served at. Rung ids are reused across ladder
# versions while the rates behind them change, so a summary that does not say which
# ladder produced it cannot be read against an older one.
LADDER_V = LADDER["version"]
SEQUENCE = json.loads((SPEC / "sequence.json").read_text())["version"]
PORT = int(os.environ.get("RB_PORT", "8080"))
EXEMPLARS = ROOT / "results" / "exemplars"
# Which targets the gate actually fails on. Everything implemented is still booted and
# still reported; a target that has not been rewired to the current endpoint set cannot
# pass, and failing on it would leave the gate red for as long as the rewiring takes.
CONFORMANCE_REQUIRED = set(MATRIX.get("conformance_required", {}).get("targets", []))

# A host with no concurrency of its own gets the serial suite: there is no knee to find,
# so the question is how long the identical pinned sequence took rather than what rate it
# sustained. Hosts that run a real server keep the rate ladder.
SUITE_FOR_HOST = {"container": "blend", "gcp-func": "serial",
                  "lambda-rie": "serial", "azure-func": "serial"}
ENCODING_FOR_HOST = {"lambda-rie": "lambda"}
LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations"


def lambda_event(method, path):
    """The full API Gateway v2 shape the drivers send.

    A minimal event is not enough: serverless-express reads headers and
    queryStringParameters directly, so a probe that omits them throws inside the adapter
    and the target looks like it never became ready.
    """
    return json.dumps({
        "version": "2.0", "rawPath": path, "rawQueryString": "",
        "queryStringParameters": {},
        # A real API Gateway event always carries host. An adapter that rebuilds a URL
        # from the request answers 400 without it, before the framework sees anything.
        "headers": {"content-type": "application/json", "host": "rb.invalid"},
        "requestContext": {"http": {"method": method, "path": path}},
        "isBase64Encoded": False,
    })


class Local:
    """Run a target as a host process. The fast edit loop, and what CI validates with."""

    def __init__(self, language, name):
        self.language, self.name, self.proc, self.fh = language, name, None, None
        self.log = ROOT / "results" / (".target-%s-%s.log" % (language, name))

    def _argv(self):
        """A target is a framework plus a host, and the host decides what starts it."""
        d = target_dir(self.name)
        host = os.environ.get("RB_HOST", "container")
        if self.language == "node":
            nd = ROOT / "targets/node"
            env = {"RB_TARGET": d, "RB_HOST": host}
            if host == "container":
                return ["node", str(nd / "_hosts/container.mjs")], nd, env
            if host == "gcp-func":
                # The Functions Framework CLI is the real entrypoint on Cloud Run, so it
                # is the one used here rather than a hand-rolled server around the library.
                return ([str(nd / "node_modules/.bin/functions-framework"),
                         "--target=rb", "--source=_hosts/gcp-func.mjs",
                         "--port=%d" % PORT], nd, env)
            raise SystemExit("node has no launcher for host %r" % host)
        if self.language == "go":
            if host != "container":
                raise SystemExit("go has no launcher for host %r yet" % host)
            return (["go", "run", "./" + d], ROOT / "targets/go",
                    {"RB_FIXTURE": str(ROOT / "spec/fixture.json"), "RB_HOST": host})
        if self.language == "java":
            # The jar is prebuilt by `make java` rather than built here: maven resolving a
            # framework's tree takes longer than the boot budget, and a validation job that
            # boots every target should pay for that once, not once per target.
            if host != "container":
                raise SystemExit("java has no local launcher for host %r; use --mode docker"
                                 % host)
            # Shaded targets produce server.jar; Quarkus names its uber jar
            # server-runner.jar. Both Dockerfiles take whichever exists, and so does this.
            built = ROOT / "targets/java" / d / "target"
            jar = next((built / n for n in ("server.jar", "server-runner.jar")
                        if (built / n).exists()), None)
            if jar is None:
                raise SystemExit("no server.jar or server-runner.jar in %s; run 'make java'"
                                 % built)
            return (["java", "-jar", str(jar)], ROOT / "targets/java",
                    {"RB_FIXTURE": str(ROOT / "spec/fixture.json"), "RB_HOST": host})
        raise SystemExit("language %r has no local launcher; use --mode docker" % self.language)

    def start(self):
        argv, cwd, extra = self._argv()
        # Both streams go to a file, never to a pipe. A pipe nobody drains fills its 64KB
        # buffer and blocks the target forever on write, which is exactly what Gin does:
        # it prints a full stack trace to stderr on every panic, and /boom panics 64 times
        # during conformance. The file also survives the run, so a boot failure is readable.
        self.log.parent.mkdir(exist_ok=True)
        self.fh = self.log.open("wb")
        self.proc = subprocess.Popen(argv, cwd=cwd, env={**os.environ, **extra},
                                     stdout=self.fh, stderr=subprocess.STDOUT,
                                     start_new_session=True)
        return self

    def tail(self, n=15):
        try:
            return "\n".join(self.log.read_text(errors="replace").splitlines()[-n:])
        except OSError:
            return "(no log)"

    def alive(self):
        return self.proc.poll() is None

    def stop(self):
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            self.proc.wait(timeout=10)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            pass
        if self.fh:
            self.fh.close()


def cpu_model():
    """platform.processor() is empty on Linux, and the runner's CPU is the single most
    useful thing to know when a hosted machine's numbers look unlike last night's."""
    try:
        for line in pathlib.Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


class Container:
    """Run a target as a container with a pinned CPU budget. What measurement uses."""
    CPUS = os.environ.get("RB_CPUS", "2")
    CPUSET = os.environ.get("RB_SUT_CPUS", "")

    def __init__(self, language, name):
        self.language, self.name = language, name
        self.host = os.environ.get("RB_HOST", "container")
        special = (ROOT / "targets" / language / ("Dockerfile." + self.host.split("-")[0])).exists()
        suffix = "-" + self.host.split("-")[0] if special else ""
        self.cname = "rb-%s-%s%s" % (language, name, suffix)
        self.image = "rb/%s-%s%s" % (language, name, suffix)

    def build(self):
        # Only a host that needs a different base image gets its own Dockerfile. Go serves
        # gcp-func from the same binary, switching on RB_HOST, so it reuses the default.
        dockerfile = ROOT / "targets" / self.language / ("Dockerfile." + self.host.split("-")[0])
        if self.host == "container" or not dockerfile.exists():
            dockerfile = ROOT / "targets" / self.language / "Dockerfile"
        subprocess.run(["docker", "build", "-q", "-f", str(dockerfile),
                        "--build-arg", "TARGET=" + target_dir(self.name),
                        "-t", self.image, "."],
                       cwd=ROOT, check=True, capture_output=True)
        return self

    def start(self):
        subprocess.run(["docker", "rm", "-f", self.cname], capture_output=True)
        argv = ["docker", "run", "-d", "--rm", "--name", self.cname,
                # Without this a target defaults to the container host whatever it was
                # asked for, and the run records the wrong host against real numbers.
                "-e", "RB_HOST=" + self.host]
        if self.CPUSET:
            # Keeping the target and the load generator off each other's cores is the
            # difference between measuring a framework and measuring contention.
            #
            # Placement alone, with no --cpus quota on top of it. The cpuset already caps
            # the target at the width of the set, and a quota is enforced per 100ms
            # period: a burst that spends it is throttled until the period rolls over,
            # which lands in p99 as jitter belonging to the cgroup rather than to the
            # framework. On a shared machine with no cpuset there is nothing to place
            # onto, so the quota stays as the only budget there is.
            argv += ["--cpuset-cpus", self.CPUSET]
        else:
            argv += ["--cpus", self.CPUS]
        subprocess.run(argv + ["-p", "%d:8080" % PORT, self.image],
                       check=True, capture_output=True)
        return self

    def alive(self):
        out = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", self.cname],
                             capture_output=True, text=True)
        return out.stdout.strip() == "true"

    def logs(self):
        out = subprocess.run(["docker", "logs", self.cname], capture_output=True, text=True)
        return out.stdout + out.stderr

    def stop(self):
        subprocess.run(["docker", "stop", "-t", "3", self.cname], capture_output=True)


def launcher(mode, language, name):
    return Local(language, name) if mode == "local" else Container(language, name).build()

def warmup_class(language):
    return "jit" if language in MATRIX["warmup_classes"]["jit"] else "steady"

def wait_healthy(target, timeout):
    """Wait for a 200 from /health, not merely for the port to accept.

    `docker run -p` publishes the port before the process inside has bound, so a TCP
    connect succeeds while the app is still starting. Conformance would then fire its
    first requests into a socket nobody is reading and record an empty body as that
    endpoint's fingerprint, which surfaces later as a body mismatch on whichever
    endpoints happened to land in the gap.
    """
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    start = time.time()
    deadline = start + timeout
    while time.time() < deadline:
        if not target.alive():
            raise RuntimeError("target exited during boot")
        try:
            c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=2.0)
            if encoding == "lambda":
                # RIE serves only the invocations endpoint, so readiness is a real
                # invocation and the status lives inside the returned envelope.
                c.request("POST", LAMBDA_INVOKE, body=lambda_event("GET", "/health"),
                          headers={"content-type": "application/json"})
                r = c.getresponse()
                body = r.read()
                c.close()
                if r.status == 200 and json.loads(body).get("statusCode") == 200:
                    return round(time.time() - start, 2)
            else:
                c.request("GET", "/health")
                r = c.getresponse()
                body = r.read()
                c.close()
                if r.status == 200 and body:
                    return round(time.time() - start, 2)
        except (OSError, http.client.HTTPException, ValueError):
            pass
        time.sleep(0.1)
    raise RuntimeError("target never became ready in %ss (encoding %s)" % (timeout, encoding))

def run_gen(rate, seconds, workers, record=True):
    # Histograms go through a file rather than the pipe: a full rung is megabytes of
    # base64 and stdout stays readable for a human watching the run.
    tmp = ROOT / "results" / (".gen-%s.json" % uuid.uuid4().hex[:8])
    cmd = ["node", str(ROOT / "gen" / "blend.mjs"), "--target", "127.0.0.1:%d" % PORT,
           "--rate", str(rate), "--seconds", str(seconds), "--workers", str(workers),
           "--maxInflight", "1024", "--out", str(tmp)]
    gen_cpus = os.environ.get("RB_GEN_CPUS", "")
    if gen_cpus and shutil.which("taskset"):
        cmd = ["taskset", "-c", gen_cpus] + cmd
    if not record:
        cmd += ["--record", "false"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        if out.returncode != 0:
            raise RuntimeError("generator failed: %s" % out.stderr[-600:])
        return json.loads(tmp.read_text())
    finally:
        tmp.unlink(missing_ok=True)

def wait_port_free(port, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket() as s:
            s.settimeout(0.3)
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return True
        time.sleep(0.2)
    return False


def read_meta():
    """Ask the target what it is. /__meta is outside the blend spec on purpose: it is not
    measured and not conformance-checked, it exists so a point on the results chart can be
    attributed to a framework version rather than to a different runner."""
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    try:
        c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=5)
        if encoding == "lambda":
            c.request("POST", LAMBDA_INVOKE, body=lambda_event("GET", "/__meta"),
                      headers={"content-type": "application/json"})
            r = c.getresponse()
            env = json.loads(r.read())
            c.close()
            return json.loads(env.get("body") or "{}") if env.get("statusCode") == 200 else {}
        c.request("GET", "/__meta")
        r = c.getresponse()
        body = r.read()
        c.close()
        if r.status == 200:
            return json.loads(body)
    except (OSError, http.client.HTTPException, ValueError):
        pass
    return {}


def run_serial(count, encoding, warmup):
    tmp = ROOT / "results" / (".gen-%s.json" % uuid.uuid4().hex[:8])
    cmd = ["node", str(ROOT / "gen" / "serial.mjs"), "--target", "127.0.0.1:%d" % PORT,
           "--encoding", encoding, "--count", str(count), "--warmup", str(warmup),
           "--out", str(tmp)]
    gen_cpus = os.environ.get("RB_GEN_CPUS", "")
    if gen_cpus and shutil.which("taskset"):
        cmd = ["taskset", "-c", gen_cpus] + cmd
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        if out.returncode != 0:
            raise RuntimeError("serial driver failed: %s" % out.stderr[-600:])
        return json.loads(tmp.read_text())
    finally:
        tmp.unlink(missing_ok=True)


def billed_durations(text):
    """RIE prints a REPORT line per invocation. Billed duration is what costs money, and
    no HTTP-level timing exposes it."""
    hist = collections.Counter()
    for m in re.finditer(r"Billed Duration: (\d+) ms", text):
        hist[int(m.group(1))] += 1
    return dict(sorted(hist.items()))


def conform(reference, is_reference, exemplars=None):
    """Gate the running target, against the language's baseline measured in this run.

    The baseline boots first and records what it answered; every target after it is
    compared to that. Nothing is stored between runs, because a committed reference makes
    every target answer forever to one target's serialization choices at one moment, and a
    change in the reference then reads as a failure in everything else.
    """
    # The gate has to speak the host's encoding. A RIE container serves only the
    # invocations endpoint, so plain HTTP reaches nothing and every target fails.
    argv = [sys.executable, str(ROOT / "harness" / "conform.py"),
            "127.0.0.1:%d" % PORT, "--quiet",
            "--reference" if is_reference else "--compare", str(reference)]
    if exemplars:
        argv += ["--exemplars", str(exemplars)]
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    if encoding != "http":
        argv += ["--encoding", encoding]
    out = subprocess.run(argv, capture_output=True, text=True, cwd=ROOT)
    lines = [l.strip() for l in out.stdout.strip().splitlines() if l.strip()]
    # The summary line is what says how bad it is. Reporting the last line reported whichever
    # diagnostic happened to print last, so a target failing forty-one endpoints announced
    # itself as one body mismatch.
    i = next((k for k in reversed(range(len(lines))) if "endpoints conform" in lines[k]), None)
    if i is None:
        return out.returncode == 0, lines[-1] if lines else out.stderr
    why = "   " + lines[i + 1] if i + 1 < len(lines) else ""
    return out.returncode == 0, lines[i] + why


def safely(fn, *args):
    """Nothing here is worth losing a measurement over. A run that cannot say which code
    it measured is still worth recording; it just says so rather than writing a row that
    looks complete."""
    try:
        return fn(*args)
    except Exception as e:
        print("  WARNING: %s failed (%s); this run will not be attributable to code"
              % (fn.__name__, e))
        return ""


def bundle_hashes(language, target):
    return safely(bundle.hashes, language, target) or {}


def env_fingerprint(run_id, languages, baselines):
    # commit and repo are what turn a row of numbers into something traceable back to the
    # code that produced it. They cannot be added later, because the record is meant to say
    # what was true when the measurement was taken. docs/bundles.html §8.
    return {"kind": "env", "run_id": run_id, "languages": languages, "baselines": baselines,
            "commit": safely(bundle.commit), "repo": safely(bundle.repo),
            "host": platform.node(), "cpu": cpu_model(),
            "cores": os.cpu_count(), "platform": platform.platform(),
            "exec_host": os.environ.get("RB_HOST", "container"),
            "sut_cpus": os.environ.get("RB_SUT_CPUS", ""),
            "gen_cpus": os.environ.get("RB_GEN_CPUS", ""),
            # Published times are only reproducible while the machine holds still, so what
            # it was actually doing is part of the result rather than a setup detail.
            "machine": safely(machine.state) or {"available": False},
            "runtime": subprocess.run(["node", "-v"], capture_output=True, text=True)
                        .stdout.strip(),
            "generator": "blend.mjs/node", "epoch": 1, "suite": BLEND,
            "ladder": LADDER_V}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", required=True,
                    help="comma separated language:target pairs. A name may repeat, "
                         "which measures that target in two positions in one run")
    ap.add_argument("--seconds", type=int, default=0, help="override rung duration")
    ap.add_argument("--rungs", default="",
                    help="comma separated rate names or numbers, default all. "
                         "spec/ladder.json names them: regular, raised")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--skip-conform", action="store_true")
    ap.add_argument("--exemplars", action="store_true",
                    help="rewrite results/exemplars for every target that conforms")
    ap.add_argument("--mode", choices=["local", "docker"], default="local")
    ap.add_argument("--suite", choices=["auto", "blend", "serial"], default="auto",
                    help="auto picks by host: a server gets the ladder, a function host "
                         "gets the pinned serial sequence")
    ap.add_argument("--count", type=int, default=20000,
                    help="serial suite: how many requests of the pinned sequence to replay")
    ap.add_argument("--validate-only", action="store_true",
                    help="boot and conform every target, then stop; no load is generated")
    ap.add_argument("--emit-path", metavar="FILE",
                    help="write the results file path here, so callers need not glob")
    ap.add_argument("--require-pinned", action="store_true",
                    help="refuse to run unless the machine is configured to be measured "
                         "on: see harness/machine.py for what that means")
    a = ap.parse_args()

    # A misconfigured machine produces numbers that describe the configuration, and they
    # are indistinguishable afterwards from numbers that describe a framework. Checked
    # before anything boots so the failure costs seconds rather than a night.
    bad = machine.problems(safely(machine.state) or {})
    if bad:
        for b in bad:
            print("machine: %s" % b)
        if a.require_pinned:
            sys.exit("refusing to measure: the machine is not pinned")

    # A cross-language run is one job on one machine measuring every language back to
    # back. Within-language ratios still work because each language's baseline is in the
    # list; absolutes become comparable across languages because nothing moved between them.
    pairs = []
    for entry in a.targets.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if ":" not in entry:
            sys.exit("target %r is not language:target" % entry)
        lang, _, name = entry.partition(":")
        if lang not in MATRIX["languages"]:
            sys.exit("unknown language %r in target %r" % (lang, entry))
        pairs.append((lang, name))
    if not pairs:
        sys.exit("no targets")
    languages = list(dict.fromkeys(lang for lang, _ in pairs))
    baselines = {lang: MATRIX["languages"][lang]["baseline"] for lang in languages}

    want = [x.strip() for x in a.rungs.split(",") if x.strip()]
    rungs = [r for r in LADDER["rungs"]
             if not want or str(r["rung"]) in want or r["name"] in want]
    if want and not rungs:
        sys.exit("no rate matches %r; spec/ladder.json has %s"
                 % (a.rungs, ", ".join("%s (%d)" % (r["name"], r["rung"])
                                       for r in LADDER["rungs"])))
    secs = a.seconds or None
    warm_s = max(LADDER["warmup"]["seconds"][warmup_class(lang)] for lang in languages)
    if a.seconds:
        warm_s = max(5, a.seconds // 2)

    # A run is one host. Its identity is the machine it measured on, not the targets that
    # happened to be on it.
    host = os.environ.get("RB_HOST", "container")
    run_id = "%s.%s.%s" % (time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), host,
                           uuid.uuid4().hex[:6])
    out_path = ROOT / "results" / ("%s.jsonl" % run_id.replace(":", ""))
    out_path.parent.mkdir(exist_ok=True)
    rows = [env_fingerprint(run_id, languages, baselines)]
    rows[0]["cross_language"] = len(languages) > 1

    rows[0]["mode"] = a.mode
    if a.mode == "docker":
        rows[0]["cpus"] = Container.CPUSET or Container.CPUS
    suite = a.suite if a.suite != "auto" else SUITE_FOR_HOST.get(host, "blend")
    encoding = ENCODING_FOR_HOST.get(host, "http")
    rows[0]["suite"] = SEQUENCE if suite == "serial" else BLEND
    what = "language=%s" % languages[0] if len(languages) == 1 else "languages=%s" % ",".join(languages)
    if a.validate_only:
        print("run %s   %s  mode=%s  VALIDATE ONLY" % (run_id, what, a.mode))
    elif suite == "serial":
        print("run %s   %s  host=%s  suite=serial  %s requests  %d targets"
              % (run_id, what, host, f"{a.count:,}", len(pairs)))
    else:
        print("run %s   %s  mode=%s  warmup=%ss  rates=%s  %d targets"
              % (run_id, what, a.mode, warm_s,
                 " ".join("%s@%d" % (r["name"], r["rps"]) for r in rungs), len(pairs)))

    conformed, boot_failed, nonconforming, unlisted = 0, [], [], []
    reference_ok = set()
    for language, target in pairs:
        key = "%s:%s" % (language, target)
        print("\n=== %s%s ===" % (("%s:" % language) if len(languages) > 1 else "", target))
        t = launcher(a.mode, language, target).start()
        try:
            # `go run` compiles on first launch, which no boot budget should punish.
            # Otherwise the budget is the language's: a JVM target spends seconds starting
            # that a steady runtime does not, and 20s fails Spring Boot on two pinned cores.
            try:
                wait_healthy(t, 240 if (a.mode == "local" and language == "go")
                                else LADDER["boot_timeout_s"][warmup_class(language)])
            except RuntimeError as e:
                print("  BOOT FAILED: %s" % e)
                boot_failed.append(key)
                if hasattr(t, "tail"):
                    print("  --- target log ---\n%s" % t.tail())
                continue
            meta = read_meta()
            if meta:
                print("  booted   %s %s on %s%s" % (meta.get("framework", target),
                                                    meta.get("version", "?"),
                                                    meta.get("runtime", "?"),
                                                    " via " + meta["adapter"]
                                                    if meta.get("adapter") else ""))
                rows.append({"kind": "target", "run_id": run_id, "language": language,
                             "target": target,
                             "host": os.environ.get("RB_HOST", "container"), **meta,
                             **bundle_hashes(language, target)})
            else:
                print("  booted   (no /__meta; version unknown)")
            if not a.skip_conform:
                reference = ROOT / "results" / (".ref-%s-%s.json"
                                                % (run_id.replace(":", ""), language))
                is_reference = target == baselines[language]
                # Only a baseline that conformed is worth comparing against. One that did
                # not is serving something else, and every difference from it would be
                # reported against the target rather than against the baseline.
                usable = reference.exists() and language in reference_ok
                # The baseline goes first in every run and is the reference when it
                # conforms. When it does not, the first target that does takes its place,
                # so the targets after it are still compared against something rather than
                # each writing a reference nobody reads.
                writes_reference = is_reference or not usable
                if not is_reference and not usable:
                    print("  note: no conforming %s reference yet in this run, so responses "
                          "are only status-checked" % language)
                # The site reads one capture per target from results/exemplars, and the
                # gate is the only thing that has every response in hand. Writing them
                # here is what keeps them from describing an endpoint set two specs old.
                exemplars = (EXEMPLARS / ("%s-%s@%s.json" % (language, target, host))
                             if a.exemplars else None)
                ok, line = conform(reference, writes_reference, exemplars)
                print("  conformance: %s" % line)
                if not ok:
                    nonconforming.append(key)
                    print("  %s: target does not conform"
                          % ("FAILED" if key in CONFORMANCE_REQUIRED else "pending rewiring"))
                    continue
                conformed += 1
                if writes_reference:
                    reference_ok.add(language)
                if key not in CONFORMANCE_REQUIRED:
                    unlisted.append(key)
                    print("  conforms but is not in conformance_required; add it there")
            if a.validate_only:
                continue

            if suite == "serial":
                # A JIT runtime is still compiling after the few hundred invocations a
                # steady runtime needs, so the warmup count is the language's too.
                warm_n = LADDER["warmup"]["serial_requests"][warmup_class(language)]
                res = run_serial(a.count, encoding, min(warm_n, max(1, a.count // 2)))
                o = res["overall"]
                print("  serial  %s requests in %6.2fs -> %5d rps   p50 %5dus  p99 %6dus"
                      % (f"{res['completed']:,}", res["elapsed_s"], res["achieved_rps"],
                         o["p50_us"], o["p99_us"]))
                if res.get("timeouts"):
                    print("  WARNING: %d request(s) timed out; elapsed is not trustworthy"
                          % res["timeouts"])
                billed = billed_durations(t.logs()) if hasattr(t, "logs") else {}
                if billed:
                    print("  billed  %s"
                          % "  ".join("%dms x%s" % (k, f"{v:,}") for k, v in billed.items()))
                for ep in res["endpoints"]:
                    rows.append({"kind": "sample", "run_id": run_id, "epoch": 1,
                                 "suite": SEQUENCE, "arm": None, "language": language,
                                 "host": host, "target": target, "rung": 1,
                                 "offered_rps": 0, "achieved_rps": res["achieved_rps"],
                                 "seconds": res["elapsed_s"], "endpoint": ep["id"],
                                 "family": ep["family"], "count": ep["count"],
                                 "errors": ep["errors"], "mismatch": ep["mismatch"],
                                 "p50_us": ep["p50_us"], "p99_us": ep["p99_us"],
                                 "hist_b64": ep["hist_b64"]})
                rows.append({"kind": "rung", "run_id": run_id, "language": language,
                             "target": target, "rung": 1, "offered_rps": 0,
                             "achieved_rps": res["achieved_rps"],
                             "seconds": res["elapsed_s"], "dropped": 0,
                             "errors": res["errors"],
                             "status_mismatch": res["status_mismatch"],
                             "elapsed_s": res["elapsed_s"], "billed_ms": billed,
                             **{k: o[k] for k in ("count", "p50_us", "p90_us",
                                                  "p99_us", "p999_us")}})
                continue

            print("  warmup %ss @ %s rps" % (warm_s, LADDER["warmup"]["rps"]))
            run_gen(LADDER["warmup"]["rps"], warm_s, a.workers, record=False)

            for r in rungs:
                dur = secs or r["seconds"]
                # Step into the rate before recording at it: the connection pool and the
                # collector adjust to a new offered rate, and the first seconds would
                # measure that adjustment. The window is unrecorded either way, so it
                # doubles as the probe that decides whether the full sample is worth
                # spending. A target dropping at twenty seconds drops at four minutes.
                settle_s = min(LADDER.get("settle_s", 0), max(1, dur // 4))
                if settle_s:
                    probe = run_gen(r["rps"], settle_s, a.workers, record=False)
                    offered = r["rps"] * settle_s
                    frac = probe["dropped"] / offered if offered else 0
                    if frac > LADDER["abort"]["drop_fraction"]:
                        print("  %-7s %6d rps -> %6d achieved   ABORTED, dropping %.1f%% "
                              "after %ds" % (r["name"], r["rps"], probe["achieved_rps"],
                                             frac * 100, settle_s))
                        rows.append({"kind": "rung", "run_id": run_id, "language": language,
                                     "target": target, "rung": r["rung"], "rate": r["name"],
                                     "offered_rps": r["rps"],
                                     "achieved_rps": probe["achieved_rps"],
                                     "seconds": settle_s, "completed": False,
                                     "dropped": probe["dropped"], "errors": probe["errors"],
                                     "status_mismatch": probe["status_mismatch"],
                                     "count": 0, "p50_us": None, "p90_us": None,
                                     "p99_us": None, "p999_us": None})
                        continue
                res = run_gen(r["rps"], dur, a.workers)
                o = res["overall"]
                offered = r["rps"] * dur
                # Percentiles here are computed over what completed, and a dropped request
                # never entered a histogram. Publishing them for a target that did not
                # keep up would report the survivors and flatter the worst collapses.
                completed = not offered or (res["dropped"] / offered
                                            <= LADDER["publish"]["max_drop_fraction"])
                print("  %-7s %6d rps -> %6d achieved   p50 %5dus  p99 %6dus  drop %d  err %d%s"
                      % (r["name"], r["rps"], res["achieved_rps"], o["p50_us"], o["p99_us"],
                         res["dropped"], res["errors"], "" if completed else "   NOT PUBLISHED"))
                for ep in res["endpoints"]:
                    rows.append({"kind": "sample", "run_id": run_id, "epoch": 1,
                                 "suite": BLEND, "arm": None, "language": language,
                                 "target": target, "rung": r["rung"], "rate": r["name"],
                                 "offered_rps": r["rps"], "completed": completed,
                                 "achieved_rps": res["achieved_rps"], "seconds": dur,
                                 "endpoint": ep["id"], "family": ep["family"],
                                 "count": ep["count"], "errors": ep["errors"],
                                 "mismatch": ep["mismatch"], "p50_us": ep["p50_us"],
                                 "p99_us": ep["p99_us"], "hist_b64": ep["hist_b64"]})
                rows.append({"kind": "rung", "run_id": run_id, "language": language, "target": target,
                             "rung": r["rung"], "rate": r["name"], "offered_rps": r["rps"],
                             "achieved_rps": res["achieved_rps"], "seconds": dur,
                             "completed": completed,
                             "dropped": res["dropped"], "errors": res["errors"],
                             "status_mismatch": res["status_mismatch"], **{
                                 k: o[k] for k in ("count", "p50_us", "p90_us", "p99_us", "p999_us")}})
        finally:
            t.stop()
            # A survivor still holding the port makes the next target contend with it, which
            # showed up as a wildly inflated elapsed time with normal-looking percentiles.
            if not wait_port_free(PORT, 15):
                print("  WARNING: port %d still held after teardown" % PORT)
            time.sleep(0.5)   # cooldown so the next target does not inherit a warm socket table

    if a.validate_only:
        print("\n%d/%d targets conform" % (conformed, len(pairs)))
        required_bad = [k for k in nonconforming if k in CONFORMANCE_REQUIRED]
        pending = [k for k in nonconforming if k not in CONFORMANCE_REQUIRED]
        if pending:
            print("  %d not yet rewired to the current spec: %s"
                  % (len(pending), ", ".join(pending)))
        # A target that starts conforming on its own is the signal to add it, not something
        # to pass silently: the list is what the gate protects, so it has to stay current.
        if unlisted:
            print("  %d conform but are unlisted: %s" % (len(unlisted), ", ".join(unlisted)))
        if boot_failed:
            print("  %d FAILED TO BOOT: %s" % (len(boot_failed), ", ".join(boot_failed)))
        if required_bad:
            print("  %d required and not conforming: %s"
                  % (len(required_bad), ", ".join(required_bad)))
        return 1 if (required_bad or boot_failed or unlisted) else 0

    with out_path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    print("\nwrote %s  (%d rows, %.0f KB)" % (out_path, len(rows), out_path.stat().st_size / 1024))
    if a.emit_path:
        pathlib.Path(a.emit_path).write_text(str(out_path))
    return 0

if __name__ == "__main__":
    sys.exit(main())
