"""RequestBench orchestrator: boot, gate, warm, measure each rate, record, tear down.

  python3 harness/run.py --languages node
  python3 harness/run.py --targets node:fastify --seconds 20 --rungs regular
  python3 harness/run.py --families json --frameworks gin,fastify
"""
import argparse, functools, hashlib, http.client, json, os, pathlib, platform, random, shutil, signal, socket, subprocess, sys, time, uuid

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
ENDPOINTS = json.loads((SPEC / "endpoints.json").read_text())["endpoints"]
BLEND = json.loads((SPEC / "endpoints.json").read_text())["version"]
# And which rates those endpoints were served at. Rung ids are reused across ladder
# versions while the rates behind them change, so a summary that does not say which
# ladder produced it cannot be read against an older one.
LADDER_V = LADDER["version"]
SEQUENCE = json.loads((SPEC / "sequence.json").read_text())["version"]
# Every target in a run gets its own published port, claimed as one block at startup, so
# two runs on one machine never fight over 8080. Above the crowded 8080/8443 neighbourhood
# and below the ephemeral floor on both platforms -- Linux defaults ip_local_port_range to
# 32768-60999 and macOS portrange.first to 49152 -- so a block can never collide with an
# outbound socket.
PORT_RANGE = (19080, 32768)
# Wide enough for the 36 frameworks spec/matrix.json lists, of which 33 are implemented.
PORT_BLOCK = 40
# An explicit base, for pointing a run at a target booted by hand.
PORT_BASE = int(os.environ["RB_PORT"]) if os.environ.get("RB_PORT") else None
EXEMPLARS = ROOT / "results" / "exemplars"
# There is no exemption list. Every implemented target has to conform, because a target
# that does not is not measured and a gate that passes anyway says nothing. The list that
# used to sit here let fourteen targets answer a two-version-old endpoint set behind a
# green check for as long as they stayed on it.

# A host with no concurrency of its own gets the serial suite: there is no knee to find,
# so the question is how long the identical pinned sequence took rather than what rate it
# sustained. Hosts that run a real server keep the rate ladder.
SUITE_FOR_HOST = {"container": "blend", "gcp-func": "serial",
                  "lambda-rie": "serial", "azure-func": "serial"}
ENCODING_FOR_HOST = {"lambda-rie": "lambda"}
LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations"
# One vCPU, which Lambda gives a function at 1,769 MB. A serial invocation runs on one
# thread either way, but a runtime's own threads, its JIT compiler and garbage collector,
# would have a second core to themselves, and a Lambda function of that size has none.
CPUS_FOR_HOST = {"lambda-rie": 1}
# A Lambda host's events go through gen/runtime-api.mjs rather than RIE. It runs in a
# container of its own that shares the function's network namespace, so the runtime polls
# it on loopback as it polled RIE, and it runs on the generator's cores, not the function's.
RUNTIME_API_IMAGE = "node:24-alpine"
RUNTIME_API_PORT = 9001
# The configuration Lambda hands a runtime in its environment, which RIE supplied before.
# The Java bootstrap reads the memory size to set the heap, so it has to be the size that
# goes with CPUS_FOR_HOST.
LAMBDA_ENV = {"AWS_LAMBDA_FUNCTION_NAME": "rb", "AWS_LAMBDA_FUNCTION_VERSION": "$LATEST",
              "AWS_LAMBDA_FUNCTION_MEMORY_SIZE": "1769",
              "AWS_LAMBDA_INITIALIZATION_TYPE": "on-demand",
              "AWS_LAMBDA_LOG_GROUP_NAME": "/aws/lambda/rb", "AWS_LAMBDA_LOG_STREAM_NAME": "rb",
              "AWS_REGION": "us-east-1", "AWS_DEFAULT_REGION": "us-east-1"}


def select(universe, include, exclude, what):
    """Narrow a list by an include list, an exclude list, or both. Empty means everything.

    Order follows `universe` rather than the order they were named, because a run measures
    targets back to back and the order is part of what it recorded.
    """
    inc = {x.strip() for x in include.split(",") if x.strip()}
    exc = {x.strip() for x in exclude.split(",") if x.strip()}
    known = set(universe)
    # Only an include has to name something real. Asking to exclude what is not there is
    # already satisfied, and failing on it would stop `--not-languages java` composing
    # with any selection that had no java in it to begin with.
    for bad in sorted(inc - known):
        sys.exit("unknown %s %r; known: %s" % (what, bad, ", ".join(sorted(known))))
    return [x for x in universe if (not inc or x in inc) and x not in exc]


def implemented_pairs(host):
    """Every implemented target this execution host supports, in matrix order."""
    out, exceptions = [], MATRIX.get("host_exceptions", {})
    for language, entry in MATRIX["languages"].items():
        built = entry.get("implemented", [])
        hosts = MATRIX.get("hosts_implemented", {}).get(language, ["container"])
        if not built or host not in hosts:
            continue
        for name in built:
            if host in exceptions.get("%s:%s" % (language, name), {}).get("excluded", []):
                continue
            out.append((language, name))
    return out


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

    def __init__(self, language, name, port):
        self.language, self.name, self.port = language, name, port
        self.proc, self.fh = None, None
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
                         "--port=%d" % self.port], nd, env)
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
        if self.language == "rust":
            if host != "container":
                raise SystemExit("rust has no launcher for host %r" % host)
            # cargo builds on first launch the way `go run` does, which no boot budget
            # should punish; the debug profile is what makes that bearable locally.
            # Measurement uses --mode docker, which builds the release profile.
            return (["cargo", "run", "--quiet", "-p", "rb-" + d, "--bin", "rb-" + d],
                    ROOT / "targets/rust",
                    {"RB_FIXTURE": str(ROOT / "spec/fixture.json"), "RB_HOST": host})
        if self.language == "python":
            if host != "container":
                raise SystemExit("python has no launcher for host %r" % host)
            # The virtualenv `make python` builds, when there is one. CI installs the
            # frameworks into the interpreter it already set up, so falling back to this
            # one keeps that from needing a second environment.
            venv = ROOT / "targets/python/.venv/bin/python"
            return ([str(venv) if venv.exists() else sys.executable,
                     str(ROOT / "targets/python/_hosts/container.py")],
                    ROOT / "targets/python",
                    {"RB_TARGET": d, "RB_FIXTURE": str(ROOT / "spec/fixture.json"),
                     "RB_HOST": host})
        if self.language == "dotnet":
            if host != "container":
                raise SystemExit("dotnet has no launcher for host %r" % host)
            # The dll `make dotnet` published, run the way the container ENTRYPOINT runs it.
            # `dotnet run` would restore and build inside the boot budget, which no boot
            # budget should pay for.
            built = ROOT / "targets/dotnet" / d / "bin/Release/net10.0"
            dll = next((p for p in sorted(built.glob("RequestBench.*.dll"))
                        if "Domain" not in p.name and "Hosts" not in p.name), None)
            if dll is None:
                raise SystemExit("no built dll in %s; run 'make dotnet'" % built)
            return (["dotnet", str(dll)], ROOT / "targets/dotnet",
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
        # PORT last, and set for every language: each target reads it to decide what to
        # bind, and an inherited one would put the target somewhere the harness is not
        # looking.
        t0 = time.monotonic()
        self.proc = subprocess.Popen(argv, cwd=cwd,
                                     env={**os.environ, **extra, "PORT": str(self.port)},
                                     stdout=self.fh, stderr=subprocess.STDOUT,
                                     start_new_session=True)
        self.start_ms = (time.monotonic() - t0) * 1000
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


def cpu_ids(spec):
    """The ids in a cpuset list such as "0-2,6", in order."""
    ids = []
    for part in spec.split(","):
        lo, _, hi = part.strip().partition("-")
        if lo:
            ids += range(int(lo), int(hi or lo) + 1)
    return ids


class Container:
    """Run a target as a container with a pinned CPU budget. What measurement uses."""
    CPUS = os.environ.get("RB_CPUS", "2")
    CPUSET = os.environ.get("RB_SUT_CPUS", "")

    def __init__(self, language, name, port):
        self.language, self.name, self.port = language, name, port
        self.host = os.environ.get("RB_HOST", "container")
        special = (ROOT / "targets" / language / ("Dockerfile." + self.host.split("-")[0])).exists()
        suffix = "-" + self.host.split("-")[0] if special else ""
        # The port is in the name so two runs measuring the same target on one machine do
        # not remove each other's container the way a shared name would.
        self.base = self.cname = "rb-%s-%s%s-%d" % (language, name, suffix, port)
        self.image = "rb/%s-%s%s" % (language, name, suffix)
        self.starts = 0
        self.lambda_api = ENCODING_FOR_HOST.get(self.host) == "lambda"

    @classmethod
    def budget(cls, host):
        """The target's CPUs on this host, as a docker run flag and its value.

        Keeping the target and the load generator off each other's cores is the difference
        between measuring a framework and measuring contention. So where RB_SUT_CPUS names
        cores the target is placed on them, narrowed to the host's width, with no --cpus
        quota on top. The cpuset already caps the target at the width of the set, and a
        quota is enforced per 100ms period: a burst that spends it is throttled until the
        period rolls over, which lands in p99 as jitter belonging to the cgroup rather than
        to the framework. On a shared machine with no cpuset there is nothing to place onto,
        so the quota stays as the only budget there is.
        """
        width = CPUS_FOR_HOST.get(host)
        if cls.CPUSET:
            ids = cpu_ids(cls.CPUSET)
            return "--cpuset-cpus", ",".join(str(i) for i in (ids[:width] if width else ids))
        return "--cpus", str(width or cls.CPUS)

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
        # Each boot of a target gets a name of its own. --rm removes a container after
        # `docker stop` has returned, so a second boot under the same name can collide with
        # the removal of the first.
        self.starts += 1
        self.cname = self.base if self.starts == 1 else "%s-%d" % (self.base, self.starts)
        subprocess.run(["docker", "rm", "-f", self.cname], capture_output=True)
        argv = ["docker", "run", "-d", "--rm", "--name", self.cname,
                # Without this a target defaults to the container host whatever it was
                # asked for, and the run records the wrong host against real numbers.
                "-e", "RB_HOST=" + self.host, *self.budget(self.host)]
        if self.lambda_api:
            # The Runtime API owns the namespace and the published port. The function
            # joins it, and its entrypoint starts the runtime rather than RIE because
            # AWS_LAMBDA_RUNTIME_API is set.
            self.start_api()
            argv += ["--network", "container:" + self.api,
                     "-e", "AWS_LAMBDA_RUNTIME_API=127.0.0.1:%d" % RUNTIME_API_PORT]
            for k, v in LAMBDA_ENV.items():
                argv += ["-e", "%s=%s" % (k, v)]
        else:
            # Only the published side moves. Inside the container every target still binds
            # 8080, which is what its Dockerfile sets and exposes.
            argv += ["-p", "%d:8080" % self.port]
        t0 = time.monotonic()
        subprocess.run(argv + [self.image], check=True, capture_output=True)
        self.start_ms = (time.monotonic() - t0) * 1000
        return self

    def start_api(self):
        """Start gen/runtime-api.mjs for this boot and wait until it answers.

        It has to be listening before the function starts. A runtime whose first poll is
        refused exits rather than retrying.
        """
        self.api = self.cname + "-api"
        subprocess.run(["docker", "rm", "-f", self.api], capture_output=True)
        argv = ["docker", "run", "-d", "--rm", "--name", self.api,
                "-v", "%s:/rb/runtime-api.mjs:ro" % (ROOT / "gen" / "runtime-api.mjs")]
        if os.environ.get("RB_GEN_CPUS"):
            argv += ["--cpuset-cpus", os.environ["RB_GEN_CPUS"]]
        subprocess.run(argv + ["-p", "%d:8080" % self.port, RUNTIME_API_IMAGE,
                               "node", "/rb/runtime-api.mjs",
                               "--invoke", "8080", "--api", str(RUNTIME_API_PORT)],
                       check=True, capture_output=True)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=1)
            try:
                c.request("GET", "/ready")
                if c.getresponse().status == 204:
                    return
            except (OSError, http.client.HTTPException):
                pass
            finally:
                c.close()
            time.sleep(0.05)
        raise RuntimeError("the Lambda Runtime API never answered /ready")

    def alive(self):
        out = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", self.cname],
                             capture_output=True, text=True)
        return out.stdout.strip() == "true"

    def tail(self, n=15):
        """The Runtime API's log. A runtime that fails to start posts the reason there, and
        its own container is gone by then because of --rm."""
        if not self.lambda_api:
            return ""
        out = subprocess.run(["docker", "logs", "--tail", str(n), self.api],
                             capture_output=True, text=True)
        return (out.stdout + out.stderr).strip()

    def stop(self):
        subprocess.run(["docker", "stop", "-t", "3", self.cname], capture_output=True)
        if self.lambda_api:
            subprocess.run(["docker", "stop", "-t", "3", self.api], capture_output=True)


def launcher(mode, language, name, port):
    return (Local(language, name, port) if mode == "local"
            else Container(language, name, port).build())

def warmup_class(language):
    return "jit" if language in MATRIX["warmup_classes"]["jit"] else "steady"

def boot_budget(mode, language):
    """How long a target may take to answer /health before it counts as failed to boot.

    `go run` compiles on first launch, which no boot budget should punish. Otherwise the
    budget is the language's: a JVM target spends seconds starting that a steady runtime
    does not, and 20s fails Spring Boot on two pinned cores.
    """
    if mode == "local" and language in ("go", "rust"):
        return 240
    return LADDER["boot_timeout_s"][warmup_class(language)]

def wait_healthy(target, port, timeout):
    """Wait for a 200 from /health, not merely for the port to accept. Returns how long that
    took and how long the probe that got the 200 took, both in milliseconds.

    `docker run -p` publishes the port before the process inside has bound, so a TCP
    connect succeeds while the app is still starting. Conformance would then fire its
    first requests into a socket nobody is reading and record an empty body as that
    endpoint's fingerprint, which surfaces later as a body mismatch on whichever
    endpoints happened to land in the gap.

    The probe interval is 2% of the time already waited, held between 1 and 50 ms. A Go
    target boots in single-digit milliseconds and a JVM in seconds, so any fixed interval
    is too coarse for one or wasteful on the other. Past 50 ms of boot this keeps the error
    within the width of a latency histogram bucket.

    The probe that gets the first 200 is the first request the target answers, and some
    runtimes spend far longer on that request than they did binding. So a probe waits for
    as long as the budget has left. One given up on after a fixed timeout would leave a
    warmer probe to be timed in its place.
    """
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    start = time.monotonic()
    deadline = start + timeout
    # Asking docker whether the container still runs costs tens of milliseconds, which
    # would set the probe interval by itself. Once a second is soon enough to stop waiting
    # on a target that has died.
    checked = start
    while time.monotonic() < deadline:
        if time.monotonic() - checked >= 1.0:
            if not target.alive():
                raise RuntimeError("target exited during boot")
            checked = time.monotonic()
        try:
            c = http.client.HTTPConnection("127.0.0.1", port,
                                           timeout=max(0.001, deadline - time.monotonic()))
            sent = time.monotonic()
            if encoding == "lambda":
                # A Lambda host serves only the invocations endpoint, so readiness is a real
                # invocation and the status lives inside the returned envelope.
                c.request("POST", LAMBDA_INVOKE, body=lambda_event("GET", "/health"),
                          headers={"content-type": "application/json"})
                r = c.getresponse()
                body = r.read()
                c.close()
                if r.status == 200 and json.loads(body).get("statusCode") == 200:
                    done = time.monotonic()
                    return (done - start) * 1000, (done - sent) * 1000
            else:
                c.request("GET", "/health")
                r = c.getresponse()
                body = r.read()
                c.close()
                if r.status == 200 and body:
                    done = time.monotonic()
                    return (done - start) * 1000, (done - sent) * 1000
        except (OSError, http.client.HTTPException, ValueError):
            pass
        time.sleep(min(0.05, max(0.001, (time.monotonic() - start) * 0.02)))
    raise RuntimeError("target never became ready in %ss (encoding %s)" % (timeout, encoding))


def boot(t, port, mode, language):
    """Start a target, wait for /health, and time the two halves apart.

    `docker run` creates and starts the container and costs 100 to 300 ms with a variance
    of its own, which is more than the whole boot of a native target. Timed only from its
    return, the number leaves the start out. Timed only across it, the framework is buried
    under it. So all three are kept: how long the start took, how long the target then took
    to answer, and the sum, which is what an operator waits through. Beside them is how long
    the answering probe took, which is the target's first request on its own.
    """
    t.start()
    ready_ms, probe_ms = wait_healthy(t, port, boot_budget(mode, language))
    return {"boot_start_ms": round(t.start_ms, 1), "boot_ready_ms": round(ready_ms, 1),
            "boot_wall_ms": round(t.start_ms + ready_ms, 1),
            "boot_probe_ms": round(probe_ms, 1)}


def ramp_edges(seconds):
    """Where each slice of a recorded warmup ends, in seconds from its start.

    Fine early and coarse late, from spec/ladder.json: the cold-to-warm transition is in the
    first seconds, and nothing interesting happens at second 70.
    """
    s = LADDER["warmup"]["slices"]
    edges, at = [], 0
    while at < seconds:
        at = min(seconds, at + (s["fine_s"] if at < s["fine_until_s"] else s["coarse_s"]))
        edges.append(at)
    return edges

def run_gen(port, rate, seconds, workers, record=True, only=None, slices=None, first=None):
    # Histograms go through a file rather than the pipe: a full rung is megabytes of
    # base64 and stdout stays readable for a human watching the run.
    tmp = ROOT / "results" / (".gen-%s.json" % uuid.uuid4().hex[:8])
    cmd = ["node", str(ROOT / "gen" / "blend.mjs"), "--target", "127.0.0.1:%d" % port,
           "--rate", str(rate), "--seconds", str(seconds), "--workers", str(workers),
           "--maxInflight", "1024", "--out", str(tmp)]
    # The warmup is filtered with the sample. Warming paths the sample never calls is the
    # opposite of what a narrowed profile is asking to measure.
    if only:
        cmd += ["--only", ",".join(only)]
    if slices:
        cmd += ["--slices", ",".join(str(s) for s in slices)]
    if first:
        cmd += ["--first", first]
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

def port_free(port):
    """Free means nothing refuses the bind and nothing answers on it.

    Two checks, because neither alone is enough. SO_REUSEADDR keeps a port whose last
    connections are still in TIME_WAIT from reading as busy, and on BSD it also lets the
    bind succeed while a container holds the wildcard address, which the connect catches.
    """
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            return False
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) != 0


def claim_ports(n, tries=50):
    """Pick a base with `n` free ports after it, so target N binds base + N.

    The base is random rather than the lowest one free, because a run claims its whole
    block up front and then binds one port at a time over the length of the run. Scanning
    from the bottom would hand a run starting now the ports an earlier run claimed and has
    not reached yet, which is the collision this is here to prevent.

    It isolates runs from each other. It does not make concurrent measurement possible:
    the loop below is strictly sequential and stops each target before starting the next,
    because two targets sharing a CPU is contention recorded as framework overhead.
    """
    if PORT_BASE:
        return PORT_BASE
    lo, hi = PORT_RANGE
    for _ in range(tries):
        base = random.randrange(lo, hi - n)
        if all(port_free(p) for p in range(base, base + n)):
            return base
    sys.exit("no free block of %d ports in %d-%d after %d tries; set RB_PORT to a base "
             "of your own" % (n, lo, hi - 1, tries))


def read_meta(port):
    """Ask the target what it is. /__meta is outside the blend spec on purpose: it is not
    measured and not conformance-checked, it exists so a point on the results chart can be
    attributed to a framework version rather than to a different runner."""
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    try:
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
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


def run_serial(port, count, encoding, warmup):
    tmp = ROOT / "results" / (".gen-%s.json" % uuid.uuid4().hex[:8])
    cmd = ["node", str(ROOT / "gen" / "serial.mjs"), "--target", "127.0.0.1:%d" % port,
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


CLIENT = ROOT / "client" / "dist" / "cli.js"


def client(port, target, *args):
    """The conformance client, which is the only thing that talks HTTP to a target.

    One replay, two authorities: --mode gate compares against another target measured in
    this run, --mode expect against spec/expected.json. Python boots targets; TypeScript
    asks them questions.
    """
    if not CLIENT.exists():
        raise SystemExit("the client is not built. Run 'npm ci && npm run build'.")
    argv = ["node", str(CLIENT), "127.0.0.1:%d" % port, "--target", target, *args]
    # The client has to speak the host's encoding. A Lambda host serves only the
    # invocations endpoint, so plain HTTP reaches nothing and every target fails.
    encoding = ENCODING_FOR_HOST.get(os.environ.get("RB_HOST", "container"), "http")
    if encoding != "http":
        argv += ["--encoding", encoding]
    return subprocess.run(argv, capture_output=True, text=True, cwd=ROOT)


def expect(port, target):
    """Check the running target against spec/expected.json, which never consults another
    target. Replaces the pytest suite; the authority and the wording are the same."""
    out = client(port, target, "--mode", "expect", "--quiet")
    lines = [l.strip() for l in out.stdout.strip().splitlines() if l.strip()]
    i = next((k for k in reversed(range(len(lines)))
              if "endpoints answer spec/expected.json" in lines[k]), None)
    if i is None:
        return out.returncode == 0, (lines[-1] if lines else out.stderr.strip())
    return out.returncode == 0, "\n      ".join([lines[i]] + lines[:i][:12])


def conform(port, target, reference, is_reference, exemplars=None):
    """Gate the running target, against the language's reference measured in this run.

    The reference boots first and records what it answered; every target after it is
    compared to that. Nothing is stored between runs, because a committed reference makes
    every target answer forever to one target's serialization choices at one moment, and a
    change in the reference then reads as a failure in everything else.
    """
    args = ["--quiet", "--reference" if is_reference else "--compare", str(reference)]
    if exemplars:
        args += ["--exemplars", str(exemplars)]
    out = client(port, target, *args)
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


def env_fingerprint(run_id, languages, references):
    # commit and repo are what turn a row of numbers into something traceable back to the
    # code that produced it. They cannot be added later, because the record is meant to say
    # what was true when the measurement was taken. docs/bundles.html §8.
    return {"kind": "env", "run_id": run_id, "languages": languages, "references": references,
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
    ap.add_argument("--targets", default="",
                    help="comma separated language:target pairs, exactly. A name may "
                         "repeat, which measures that target in two positions in one run. "
                         "Without this the run is every implemented target this host "
                         "supports, narrowed by --languages and --frameworks")
    ap.add_argument("--languages", default="", help="only these languages")
    ap.add_argument("--not-languages", default="", help="every language but these")
    ap.add_argument("--frameworks", default="", help="only these frameworks, any language")
    ap.add_argument("--not-frameworks", default="", help="every framework but these")
    ap.add_argument("--families", default="",
                    help="only these endpoint families. Narrowing the endpoint set changes "
                         "what the runtime optimises for, so the result is its own profile "
                         "and is recorded as one")
    ap.add_argument("--not-families", default="", help="every family but these")
    ap.add_argument("--endpoints", default="", help="only these endpoint ids")
    ap.add_argument("--not-endpoints", default="", help="every endpoint but these")
    ap.add_argument("--seconds", type=int, default=0, help="override rate duration")
    ap.add_argument("--warmup", type=int, default=0,
                    help="override warmup seconds, whatever the language's class asks for")
    ap.add_argument("--warmup-rps", type=int, default=0,
                    help="override the warmup rate. Warmup is drawn uniformly too, so the "
                         "per-endpoint invocation count is this divided by the live "
                         "endpoint count, which is what a JIT actually sees")
    ap.add_argument("--rps", default="",
                    help="override the offered rates, in the order they run")
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
    ap.add_argument("--expect", action="store_true",
                    help="boot every target and check it against spec/expected.json, then "
                         "stop; no load is generated")
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
    # back. Nothing moves between targets, so the absolute numbers are comparable to each
    # other however many languages are in the list.
    host = os.environ.get("RB_HOST", "container")
    if a.targets:
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
    else:
        pairs = implemented_pairs(host)
    # Narrowing applies to an explicit list too, so --targets and --not-frameworks compose
    # rather than one silently winning.
    langs_in = list(dict.fromkeys(l for l, _ in pairs))
    keep_l = set(select(langs_in, a.languages, a.not_languages, "language"))
    names_in = list(dict.fromkeys(n for _, n in pairs))
    keep_f = set(select(names_in, a.frameworks, a.not_frameworks, "framework"))
    pairs = [(l, n) for l, n in pairs if l in keep_l and n in keep_f]
    if not pairs:
        sys.exit("no targets left after filtering")
    languages = list(dict.fromkeys(lang for lang, _ in pairs))
    # What every other target in the language is fingerprint-compared against. It is the
    # language's anchor -- the framework most people would name first -- because there is
    # no longer a bare implementation to hold the job. An anchor is an ordinary framework
    # and can itself be wrong, so a mismatch names both sides rather than blaming the target.
    references = {lang: MATRIX["languages"][lang]["anchor"] for lang in languages}
    # The reference has to be measured before the targets compared against it, so it is
    # moved to the front of its language rather than left wherever the matrix or the
    # command line put it. A stable partition, so everything else keeps its order and a
    # repeated name still measures that target in two positions.
    pairs = [p for p in pairs if p[1] == references[p[0]]] + \
            [p for p in pairs if p[1] != references[p[0]]]
    languages = list(dict.fromkeys(lang for lang, _ in pairs))
    absent = [l for l in languages if (l, references[l]) not in pairs]
    if absent:
        print("note: no reference in this run for %s; responses are status-checked only"
              % ", ".join("%s (%s)" % (l, references[l]) for l in absent))

    want = [x.strip() for x in a.rungs.split(",") if x.strip()]
    rungs = [r for r in LADDER["rungs"]
             if not want or str(r["rung"]) in want or r["name"] in want]
    if want and not rungs:
        sys.exit("no rate matches %r; spec/ladder.json has %s"
                 % (a.rungs, ", ".join("%s (%d)" % (r["name"], r["rung"])
                                       for r in LADDER["rungs"])))
    # Offered rates are a spec constant, overridable for a quick loop. Given in the order
    # the selected rates run, so --rungs raised --rps 8000 means what it looks like.
    if a.rps:
        want_rps = [int(x) for x in a.rps.split(",") if x.strip()]
        if len(want_rps) != len(rungs):
            sys.exit("--rps has %d value(s) for %d rate(s): %s"
                     % (len(want_rps), len(rungs), ", ".join(r["name"] for r in rungs)))
        rungs = [{**r, "rps": v} for r, v in zip(rungs, want_rps)]

    # Which endpoints are live. A narrowed set is not the blend with rows hidden: the
    # runtime optimises for the paths it actually executes, so five endpoints out of
    # forty-five run hotter than the same five do inside the full set. That makes it a
    # separate profile, recorded as one so nothing pools it with a full run.
    fams = list(dict.fromkeys(e["family"] for e in ENDPOINTS))
    keep_fam = set(select(fams, a.families, a.not_families, "family"))
    ids = [e["id"] for e in ENDPOINTS if e["family"] in keep_fam]
    ids = select(ids, a.endpoints, a.not_endpoints, "endpoint")
    if not ids:
        sys.exit("no endpoints left after filtering")
    full_blend = len(ids) == len(ENDPOINTS)
    profile = "full" if full_blend else "subset-%s" % hashlib.sha256(
        ",".join(sorted(ids)).encode()).hexdigest()[:8]
    # None rather than the full list, so a full run passes no filter and the driver keeps
    # the plan it was given.
    live = None if full_blend else ids

    secs = a.seconds or None
    warm_s = max(LADDER["warmup"]["seconds"][warmup_class(lang)] for lang in languages)
    if a.seconds:
        warm_s = max(5, a.seconds // 2)
    if a.warmup:
        warm_s = a.warmup
    warm_rps = a.warmup_rps or LADDER["warmup"]["rps"]

    run_id = "%s.%s.%s" % (time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), host,
                           uuid.uuid4().hex[:6])
    out_path = ROOT / "results" / ("%s.jsonl" % run_id.replace(":", ""))
    out_path.parent.mkdir(exist_ok=True)
    rows = [env_fingerprint(run_id, languages, references)]
    rows[0]["cross_language"] = len(languages) > 1
    # Which endpoints were live, so a narrowed run is never read against a full one. Same
    # reason the blend and ladder versions are here: they are all statements about what
    # the numbers describe, and none of them can be reconstructed afterwards.
    rows[0]["profile"] = profile
    rows[0]["endpoints_live"] = len(ids)
    if not full_blend:
        rows[0]["profile_endpoints"] = ids

    rows[0]["mode"] = a.mode
    if a.mode == "docker":
        rows[0]["cpus"] = Container.budget(host)[1]
    suite = a.suite if a.suite != "auto" else SUITE_FOR_HOST.get(host, "blend")
    encoding = ENCODING_FOR_HOST.get(host, "http")
    rows[0]["suite"] = SEQUENCE if suite == "serial" else BLEND
    if suite == "serial":
        rows[0]["generator"] = "serial.mjs/node"
    # What the latencies time. On a Lambda host they are the Runtime API's Duration, which
    # leaves the invoke path out, and everywhere else the round trip the driver saw. They
    # are different measurements, so nothing may read one against the other.
    rows[0]["timing"] = "runtime-api" if suite == "serial" and encoding == "lambda" else "client"
    what = "language=%s" % languages[0] if len(languages) == 1 else "languages=%s" % ",".join(languages)
    base = claim_ports(max(PORT_BLOCK, len(pairs)))
    print("run %s  ports=%d+" % (run_id, base))
    if a.validate_only:
        print("  %s  mode=%s  VALIDATE ONLY" % (what, a.mode))
    elif suite == "serial":
        print("  %s  host=%s  suite=serial  %s requests  %d targets"
              % (what, host, f"{a.count:,}", len(pairs)))
    else:
        print("  %s  mode=%s  warmup=%ss  rates=%s  %d targets"
              % (what, a.mode, warm_s,
                 " ".join("%s@%d" % (r["name"], r["rps"]) for r in rungs), len(pairs)))

    boot_failed, nonconforming = [], []
    reference_ok = set()
    # Conformance gets a boot of its own. It serves every endpoint at least once, so on the
    # boot being measured it would spend the first request and the cold end of the warmup
    # before either was recorded. A separate boot costs one container start per target and
    # still stops a nonconforming target before it takes a measurement's worth of time.
    gate = not a.skip_conform or a.expect or a.validate_only
    measure = not (a.validate_only or a.expect)

    def booted(t, port, language, key):
        """The boot's timings, or None once it has said why the target did not come up."""
        try:
            return boot(t, port, a.mode, language)
        except RuntimeError as e:
            print("  BOOT FAILED: %s" % e)
            boot_failed.append(key)
            log = t.tail() if hasattr(t, "tail") else ""
            if log:
                print("  --- target log ---\n%s" % log)
            return None

    def described(meta, target):
        if not meta:
            return "(no /__meta; version unknown)"
        return "%s %s on %s%s" % (meta.get("framework", target), meta.get("version", "?"),
                                  meta.get("runtime", "?"),
                                  " via " + meta["adapter"] if meta.get("adapter") else "")

    def gated(t, port, language, target, key):
        """Boot the target for the gate alone, and say whether it may go on to be measured."""
        try:
            if booted(t, port, language, key) is None:
                return False
            print("  booted   %s" % described(read_meta(port), target))
            if not a.skip_conform:
                reference = ROOT / "results" / (".ref-%s-%s.json"
                                                % (run_id.replace(":", ""), language))
                is_reference = target == references[language]
                # Only a reference that conformed is worth comparing against. One that did
                # not is serving something else, and every difference from it would be
                # reported against the target rather than against the reference.
                usable = reference.exists() and language in reference_ok
                # The reference goes first in every run and holds the job when it
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
                ok, line = conform(port, key, reference, writes_reference, exemplars)
                print("  conformance: %s" % line)
                if not ok:
                    nonconforming.append(key)
                    print("  FAILED: target does not conform")
                    return False
                if writes_reference:
                    reference_ok.add(language)
            if a.expect:
                ok, line = expect(port, key)
                print("  expectation: %s" % line)
                if not ok:
                    nonconforming.append(key)
                    print("  FAILED: target does not answer spec/expected.json")
                    return False
            return True
        finally:
            t.stop()
            time.sleep(0.5)   # cooldown so the measured boot does not inherit a warm socket table

    def record_target(language, target, ordinal, meta, timing):
        """The measured boot's row: what the target says it is, the code it was built from,
        and how long it took to come up. Called after the load rather than before it,
        because /__meta is a request and the ramp is recorded from the first one."""
        if not gate:
            print("  booted   %s" % described(meta, target))
        own = meta.get("boot_ms")
        print("  boot     start %.1f + ready %.1f = %.1f ms; the first /health took %.1f ms%s"
              % (timing["boot_start_ms"], timing["boot_ready_ms"], timing["boot_wall_ms"],
                 timing["boot_probe_ms"],
                 "" if own is None else "; the target reports %.1f ms to listen" % own))
        rows.append({"kind": "target", "run_id": run_id, "language": language,
                     "target": target, "host": host, **meta,
                     **bundle_hashes(language, target), **timing,
                     # Where in the run this target was measured. A target thirty places in
                     # boots on a machine that has been under load for an hour, and the order
                     # is stable, so boot time can trend with position as a bias on each
                     # target rather than as noise. It only shows if the position is here.
                     "ordinal": ordinal,
                     # The gate's boot ran this image moments before, so its layers,
                     # executable and libraries are in the page cache and only the process
                     # starts cold: a scale-out onto a node that already has the image, not a
                     # first deploy onto a fresh one. Without the gate nothing says what the
                     # cache held.
                     "boot_page_cache": "warm" if gate else "unknown"})

    for n, (language, target) in enumerate(pairs):
        key = "%s:%s" % (language, target)
        port = base + n
        print("\n%-24s port %d"
              % ("=== %s%s ===" % (("%s:" % language) if len(languages) > 1 else "", target),
                 port))
        t = launcher(a.mode, language, target, port)
        if gate and not gated(t, port, language, target, key):
            continue
        if not measure:
            continue
        try:
            timing = booted(t, port, language, key)
            if timing is None:
                continue

            if suite == "serial":
                # A JIT runtime is still compiling after the few hundred invocations a
                # steady runtime needs, so the warmup count is the language's too.
                warm_n = LADDER["warmup"]["serial_requests"][warmup_class(language)]
                res = run_serial(port, a.count, encoding,
                                 min(warm_n, max(1, a.count // 2)))
                o, trip = res["overall"], res.get("round_trip")
                print("  serial  %s requests in %6.2fs -> %5d rps   p50 %5dus  p99 %6dus%s"
                      % (f"{res['completed']:,}", res["elapsed_s"], res["achieved_rps"],
                         o["p50_us"], o["p99_us"],
                         "" if trip is None else "   round trip p50 %dus  p99 %dus"
                         % (trip["p50_us"], trip["p99_us"])))
                if res.get("timeouts"):
                    print("  WARNING: %d request(s) timed out; elapsed is not trustworthy"
                          % res["timeouts"])
                billed = res.get("billed_ms", {})
                if billed:
                    print("  billed  %s"
                          % "  ".join("%sms x%s" % (k, f"{v:,}") for k, v in billed.items()))
                record_target(language, target, n + 1, read_meta(port), timing)
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
                             **({"round_trip": trip} if trip else {}),
                             **{k: o[k] for k in ("count", "p50_us", "p90_us",
                                                  "p99_us", "p999_us")}})
                continue

            print("  warmup %ss @ %s rps  (%s per live endpoint)"
                  % (warm_s, warm_rps, f"{warm_rps * warm_s // len(ids):,}"))
            # The window where a cold target becomes a warm one, on a boot that has served
            # nothing but the readiness probe. Kept as a ramp: the first request on its
            # own, then the whole distribution per slice.
            ramp = run_gen(port, warm_rps, warm_s, a.workers, record=False, only=live,
                           slices=ramp_edges(warm_s), first=LADDER["warmup"]["first"])
            record_target(language, target, n + 1, read_meta(port), timing)
            first, sl = ramp.get("first"), ramp["slices"]
            print("  ramp     %s   p99 %dus in the first %gs, %dus in the last %gs"
                  % ("first %s %s in %dus" % (first["endpoint"],
                                              first.get("status", first.get("error")),
                                              first["us"]) if first else "no first request",
                     sl[0]["p99_us"], sl[0]["seconds"], sl[-1]["p99_us"], sl[-1]["seconds"]))
            rows.append({"kind": "ramp", "run_id": run_id, "language": language,
                         "target": target, "offered_rps": warm_rps, "seconds": warm_s,
                         "achieved_rps": ramp["achieved_rps"], "dropped": ramp["dropped"],
                         "errors": ramp["errors"], "status_mismatch": ramp["status_mismatch"],
                         "first": first, "slices": sl})

            for r in rungs:
                dur = secs or r["seconds"]
                # Step into the rate before recording at it: the connection pool and the
                # collector adjust to a new offered rate, and the first seconds would
                # measure that adjustment. The window is unrecorded either way, so it
                # doubles as the probe that decides whether the full sample is worth
                # spending. A target dropping at twenty seconds drops at four minutes.
                settle_s = min(LADDER.get("settle_s", 0), max(1, dur // 4))
                if settle_s:
                    probe = run_gen(port, r["rps"], settle_s, a.workers,
                                    record=False, only=live)
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
                res = run_gen(port, r["rps"], dur, a.workers, only=live)
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
            time.sleep(0.5)   # cooldown so the next target does not inherit a warm socket table

    if a.validate_only or a.expect:
        checked = len(pairs) - len(nonconforming) - len(boot_failed)
        print("\n%d/%d targets %s" % (checked, len(pairs),
              "answer spec/expected.json" if a.expect else "conform"))
        if boot_failed:
            print("  %d FAILED TO BOOT: %s" % (len(boot_failed), ", ".join(boot_failed)))
        if nonconforming:
            print("  %d failing: %s" % (len(nonconforming), ", ".join(nonconforming)))
        return 1 if (nonconforming or boot_failed) else 0

    with out_path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    print("\nwrote %s  (%d rows, %.0f KB)" % (out_path, len(rows), out_path.stat().st_size / 1024))
    if a.emit_path:
        pathlib.Path(a.emit_path).write_text(str(out_path))
    return 0

if __name__ == "__main__":
    sys.exit(main())
