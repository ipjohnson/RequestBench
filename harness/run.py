"""RequestBench orchestrator: boot, gate, warm, ladder, record, tear down.

  python3 harness/run.py --shard node --targets node-http,fastify,express
  python3 harness/run.py --shard node --targets fastify --seconds 20 --rungs 3,5
"""
import argparse, collections, functools, http.client, json, os, pathlib, platform, re, shutil, signal, subprocess, sys, time, uuid

# Long runs are watched live; block-buffered stdout hides progress for minutes.
print = functools.partial(print, flush=True)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
LADDER = json.loads((SPEC / "ladder.json").read_text())
MATRIX = json.loads((SPEC / "matrix.json").read_text())
PORT = int(os.environ.get("RB_PORT", "8080"))

# A host with no concurrency of its own gets the serial suite: there is no knee to find,
# so the question is how long the identical pinned sequence took rather than what rate it
# sustained. Hosts that run a real server keep the rate ladder.
SUITE_FOR_HOST = {"container": "blend", "gcp-func": "serial",
                  "lambda-rie": "serial", "azure-func": "serial"}
ENCODING_FOR_HOST = {"lambda-rie": "lambda"}
LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations"


def target_dir(name):
    """Baselines live in baseline/ whatever their shard calls them."""
    return "baseline" if name in ("node-http", "net-http", "raw-asgi", "raw-kestrel",
                                  "bare-netty", "hyper") else name


class Local:
    """Run a target as a host process. The fast edit loop, and what CI validates with."""

    def __init__(self, shard, name):
        self.shard, self.name, self.proc, self.fh = shard, name, None, None
        self.log = ROOT / "results" / (".target-%s-%s.log" % (shard, name))

    def _argv(self):
        """A target is a framework plus a host, and the host decides what starts it."""
        d = target_dir(self.name)
        host = os.environ.get("RB_HOST", "container")
        if self.shard == "node":
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
        if self.shard == "go":
            if host != "container":
                raise SystemExit("go has no launcher for host %r yet" % host)
            return (["go", "run", "./" + d], ROOT / "targets/go",
                    {"RB_FIXTURE": str(ROOT / "spec/fixture.json"), "RB_HOST": host})
        raise SystemExit("shard %r has no local launcher; use --mode docker" % self.shard)

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
    """Run a target as a container with a pinned CPU budget. What the rotation uses."""
    CPUS = os.environ.get("RB_CPUS", "2")
    CPUSET = os.environ.get("RB_SUT_CPUS", "")

    def __init__(self, shard, name):
        self.shard, self.name = shard, name
        self.host = os.environ.get("RB_HOST", "container")
        suffix = "" if self.host == "container" else "-" + self.host.split("-")[0]
        self.cname = "rb-%s-%s%s" % (shard, name, suffix)
        self.image = "rb/%s-%s%s" % (shard, name, suffix)

    def build(self):
        dockerfile = ROOT / "targets" / self.shard / (
            "Dockerfile" if self.host == "container" else "Dockerfile." + self.host.split("-")[0])
        subprocess.run(["docker", "build", "-q", "-f", str(dockerfile),
                        "--build-arg", "TARGET=" + target_dir(self.name),
                        "-t", self.image, "."],
                       cwd=ROOT, check=True, capture_output=True)
        return self

    def start(self):
        subprocess.run(["docker", "rm", "-f", self.cname], capture_output=True)
        argv = ["docker", "run", "-d", "--rm", "--name", self.cname, "--cpus", self.CPUS]
        if self.CPUSET:
            # Keeping the target and the load generator off each other's cores is the
            # difference between measuring a framework and measuring contention.
            argv += ["--cpuset-cpus", self.CPUSET]
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


def launcher(mode, shard, name):
    return Local(shard, name) if mode == "local" else Container(shard, name).build()

def warmup_class(shard):
    return "jit" if shard in MATRIX["warmup_classes"]["jit"] else "steady"

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
                event = json.dumps({"version": "2.0", "rawPath": "/health",
                                    "requestContext": {"http": {"method": "GET"}}})
                c.request("POST", LAMBDA_INVOKE, body=event,
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

def read_meta():
    """Ask the target what it is. /__meta is outside the blend spec on purpose: it is not
    measured and not conformance-checked, it exists so a point on the results chart can be
    attributed to a framework version rather than to a different runner."""
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    try:
        c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=5)
        if encoding == "lambda":
            event = json.dumps({"version": "2.0", "rawPath": "/__meta",
                                "requestContext": {"http": {"method": "GET"}}})
            c.request("POST", LAMBDA_INVOKE, body=event,
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


def conform():
    out = subprocess.run([sys.executable, str(ROOT / "harness" / "conform.py"),
                          "127.0.0.1:%d" % PORT, "--quiet",
                          "--compare", str(SPEC / "fingerprint.node-http.json")],
                         capture_output=True, text=True, cwd=ROOT)
    return out.returncode == 0, out.stdout.strip().splitlines()[-1] if out.stdout else out.stderr

def env_fingerprint(run_id, shard, baseline):
    return {"kind": "env", "run_id": run_id, "shard": shard, "baseline": baseline,
            "host": platform.node(), "cpu": cpu_model(),
            "cores": os.cpu_count(), "platform": platform.platform(),
            "exec_host": os.environ.get("RB_HOST", "container"),
            "sut_cpus": os.environ.get("RB_SUT_CPUS", ""),
            "gen_cpus": os.environ.get("RB_GEN_CPUS", ""),
            "runtime": subprocess.run(["node", "-v"], capture_output=True, text=True)
                        .stdout.strip(),
            "generator": "blend.mjs/node", "epoch": 1, "suite": "blend-v1"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", help="single shard; omit when --targets is fully qualified")
    ap.add_argument("--targets", required=True,
                    help="comma separated. Either bare names with --shard, or "
                         "shard:target pairs to measure several languages in one run")
    ap.add_argument("--seconds", type=int, default=0, help="override rung duration")
    ap.add_argument("--rungs", default="", help="comma separated rung numbers, default all")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--skip-conform", action="store_true")
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
    a = ap.parse_args()

    # A cross-language run is one job on one machine measuring every language back to
    # back. Within-language ratios still work because each language's baseline is in the
    # list; absolutes become comparable across languages because nothing moved between them.
    pairs = []
    for entry in a.targets.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if ":" in entry:
            sh, _, name = entry.partition(":")
        elif a.shard:
            sh, name = a.shard, entry
        else:
            sys.exit("target %r has no shard: pass --shard or write shard:target" % entry)
        if sh not in MATRIX["languages"]:
            sys.exit("unknown shard %r in target %r" % (sh, entry))
        pairs.append((sh, name))
    if not pairs:
        sys.exit("no targets")
    shards = list(dict.fromkeys(sh for sh, _ in pairs))
    baselines = {sh: MATRIX["languages"][sh]["baseline"] for sh in shards}

    rungs = [r for r in LADDER["rungs"]
             if not a.rungs or str(r["rung"]) in a.rungs.split(",")]
    secs = a.seconds or None
    warm_s = max(LADDER["warmup"]["seconds"][warmup_class(sh)] for sh in shards)
    if a.seconds:
        warm_s = max(5, a.seconds // 2)

    tag = shards[0] if len(shards) == 1 else "x-" + "-".join(shards)
    run_id = "%s.%s.%s" % (time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), tag,
                           uuid.uuid4().hex[:6])
    out_path = ROOT / "results" / ("%s.jsonl" % run_id.replace(":", ""))
    out_path.parent.mkdir(exist_ok=True)
    rows = [env_fingerprint(run_id, tag, baselines[shards[0]])]
    rows[0]["shards"] = shards
    rows[0]["baselines"] = baselines
    rows[0]["cross_language"] = len(shards) > 1

    rows[0]["mode"] = a.mode
    if a.mode == "docker":
        rows[0]["cpus"] = Container.CPUS
    host = os.environ.get("RB_HOST", "container")
    suite = a.suite if a.suite != "auto" else SUITE_FOR_HOST.get(host, "blend")
    encoding = ENCODING_FOR_HOST.get(host, "http")
    rows[0]["suite"] = "serial-v1" if suite == "serial" else "blend-v1"
    what = "shard=%s" % shards[0] if len(shards) == 1 else "shards=%s" % ",".join(shards)
    if a.validate_only:
        print("run %s   %s  mode=%s  VALIDATE ONLY" % (run_id, what, a.mode))
    elif suite == "serial":
        print("run %s   %s  host=%s  suite=serial  %s requests  %d targets"
              % (run_id, what, host, f"{a.count:,}", len(pairs)))
    else:
        print("run %s   %s  mode=%s  warmup=%ss  rungs=%s  %d targets"
              % (run_id, what, a.mode, warm_s, [r["rung"] for r in rungs], len(pairs)))

    conformed = 0
    for shard, target in pairs:
        print("\n=== %s%s ===" % (("%s:" % shard) if len(shards) > 1 else "", target))
        t = launcher(a.mode, shard, target).start()
        try:
            # `go run` compiles on first launch, which no boot budget should punish.
            try:
                wait_healthy(t, 240 if (a.mode == "local" and shard == "go")
                                else LADDER["boot_timeout_s"])
            except RuntimeError as e:
                print("  BOOT FAILED: %s" % e)
                if hasattr(t, "tail"):
                    print("  --- target log ---\n%s" % t.tail())
                continue
            meta = read_meta()
            if meta:
                print("  booted   %s %s on %s" % (meta.get("framework", target),
                                                  meta.get("version", "?"),
                                                  meta.get("runtime", "?")))
                rows.append({"kind": "target", "run_id": run_id, "shard": shard,
                             "target": target,
                             "host": os.environ.get("RB_HOST", "container"), **meta})
            else:
                print("  booted   (no /__meta; version unknown)")
            if not a.skip_conform:
                ok, line = conform()
                print("  conformance: %s" % line)
                if not ok:
                    print("  FAILED: target does not conform")
                    continue
                conformed += 1
            if a.validate_only:
                continue

            if suite == "serial":
                res = run_serial(a.count, encoding, min(500, a.count // 10))
                o = res["overall"]
                print("  serial  %s requests in %6.2fs -> %5d rps   p50 %5dus  p99 %6dus"
                      % (f"{res['completed']:,}", res["elapsed_s"], res["achieved_rps"],
                         o["p50_us"], o["p99_us"]))
                billed = billed_durations(t.logs()) if hasattr(t, "logs") else {}
                if billed:
                    print("  billed  %s"
                          % "  ".join("%dms x%s" % (k, f"{v:,}") for k, v in billed.items()))
                for ep in res["endpoints"]:
                    rows.append({"kind": "sample", "run_id": run_id, "epoch": 1,
                                 "suite": "serial-v1", "arm": None, "shard": shard,
                                 "host": host, "target": target, "rung": 1,
                                 "offered_rps": 0, "achieved_rps": res["achieved_rps"],
                                 "seconds": res["elapsed_s"], "endpoint": ep["id"],
                                 "family": ep["family"], "count": ep["count"],
                                 "errors": ep["errors"], "mismatch": ep["mismatch"],
                                 "p50_us": ep["p50_us"], "p99_us": ep["p99_us"],
                                 "hist_b64": ep["hist_b64"]})
                rows.append({"kind": "rung", "run_id": run_id, "shard": shard,
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
                res = run_gen(r["rps"], dur, a.workers)
                o = res["overall"]
                print("  rung %d  %6d rps -> %6d achieved   p50 %5dus  p99 %6dus  drop %d  err %d"
                      % (r["rung"], r["rps"], res["achieved_rps"], o["p50_us"], o["p99_us"],
                         res["dropped"], res["errors"]))
                for ep in res["endpoints"]:
                    rows.append({"kind": "sample", "run_id": run_id, "epoch": 1,
                                 "suite": "blend-v1", "arm": None, "shard": shard,
                                 "target": target, "rung": r["rung"], "offered_rps": r["rps"],
                                 "achieved_rps": res["achieved_rps"], "seconds": dur,
                                 "endpoint": ep["id"], "family": ep["family"],
                                 "count": ep["count"], "errors": ep["errors"],
                                 "mismatch": ep["mismatch"], "p50_us": ep["p50_us"],
                                 "p99_us": ep["p99_us"], "hist_b64": ep["hist_b64"]})
                rows.append({"kind": "rung", "run_id": run_id, "shard": shard, "target": target,
                             "rung": r["rung"], "offered_rps": r["rps"],
                             "achieved_rps": res["achieved_rps"], "seconds": dur,
                             "dropped": res["dropped"], "errors": res["errors"],
                             "status_mismatch": res["status_mismatch"], **{
                                 k: o[k] for k in ("count", "p50_us", "p90_us", "p99_us", "p999_us")}})
        finally:
            t.stop()
            time.sleep(1.0)   # cooldown so the next target does not inherit a warm socket table

    if a.validate_only:
        n = len(a.targets.split(","))
        print("\n%d/%d targets conform" % (conformed, n))
        return 0 if conformed == n else 1

    if a.validate_only:
        want = len(a.targets.split(","))
        print("\n%d/%d targets conform" % (conformed, want))
        return 0 if conformed == want else 1

    with out_path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    print("\nwrote %s  (%d rows, %.0f KB)" % (out_path, len(rows), out_path.stat().st_size / 1024))
    if a.emit_path:
        pathlib.Path(a.emit_path).write_text(str(out_path))
    return 0

if __name__ == "__main__":
    sys.exit(main())
