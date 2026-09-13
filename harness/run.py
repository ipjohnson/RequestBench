"""RequestBench orchestrator: boot, gate, warm, ladder, record, tear down.

  python3 harness/run.py --shard node --targets node-http,fastify,express
  python3 harness/run.py --shard node --targets fastify --seconds 20 --rungs 3,5
"""
import argparse, functools, json, os, pathlib, platform, signal, socket, subprocess, sys, time, uuid

# Long runs are watched live; block-buffered stdout hides progress for minutes.
print = functools.partial(print, flush=True)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
LADDER = json.loads((SPEC / "ladder.json").read_text())
MATRIX = json.loads((SPEC / "matrix.json").read_text())
PORT = int(os.environ.get("RB_PORT", "8080"))

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
        d = target_dir(self.name)
        if self.shard == "node":
            return ["node", str(ROOT / "targets/node" / d / "server.js")], ROOT, {}
        if self.shard == "go":
            return (["go", "run", "./" + d], ROOT / "targets/go",
                    {"RB_FIXTURE": str(ROOT / "spec/fixture.json")})
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


class Container:
    """Run a target as a container with a pinned CPU budget. What the rotation uses."""
    CPUS = os.environ.get("RB_CPUS", "2")

    def __init__(self, shard, name):
        self.shard, self.name = shard, name
        self.cname = "rb-%s-%s" % (shard, name)
        self.image = "rb/%s-%s" % (shard, name)

    def build(self):
        subprocess.run(["docker", "build", "-q",
                        "-f", str(ROOT / "targets" / self.shard / "Dockerfile"),
                        "--build-arg", "TARGET=" + target_dir(self.name),
                        "-t", self.image, "."],
                       cwd=ROOT, check=True, capture_output=True)
        return self

    def start(self):
        subprocess.run(["docker", "rm", "-f", self.cname], capture_output=True)
        subprocess.run(["docker", "run", "-d", "--rm", "--name", self.cname,
                        "--cpus", self.CPUS, "-p", "%d:8080" % PORT, self.image],
                       check=True, capture_output=True)
        return self

    def alive(self):
        out = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", self.cname],
                             capture_output=True, text=True)
        return out.stdout.strip() == "true"

    def stop(self):
        subprocess.run(["docker", "stop", "-t", "3", self.cname], capture_output=True)


def launcher(mode, shard, name):
    return Local(shard, name) if mode == "local" else Container(shard, name).build()

def warmup_class(shard):
    return "jit" if shard in MATRIX["warmup_classes"]["jit"] else "steady"

def wait_healthy(target, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not target.alive():
            raise RuntimeError("target exited during boot")
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=0.5):
                return round(time.time() - (deadline - timeout), 2)
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("target never became healthy in %ss" % timeout)

def run_gen(rate, seconds, workers, record=True):
    # Histograms go through a file rather than the pipe: a full rung is megabytes of
    # base64 and stdout stays readable for a human watching the run.
    tmp = ROOT / "results" / (".gen-%s.json" % uuid.uuid4().hex[:8])
    cmd = ["node", str(ROOT / "gen" / "blend.mjs"), "--target", "127.0.0.1:%d" % PORT,
           "--rate", str(rate), "--seconds", str(seconds), "--workers", str(workers),
           "--maxInflight", "1024", "--out", str(tmp)]
    if not record:
        cmd += ["--record", "false"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        if out.returncode != 0:
            raise RuntimeError("generator failed: %s" % out.stderr[-600:])
        return json.loads(tmp.read_text())
    finally:
        tmp.unlink(missing_ok=True)

def conform():
    out = subprocess.run([sys.executable, str(ROOT / "harness" / "conform.py"),
                          "127.0.0.1:%d" % PORT, "--quiet",
                          "--compare", str(SPEC / "fingerprint.node-http.json")],
                         capture_output=True, text=True, cwd=ROOT)
    return out.returncode == 0, out.stdout.strip().splitlines()[-1] if out.stdout else out.stderr

def env_fingerprint(run_id, shard, baseline):
    return {"kind": "env", "run_id": run_id, "shard": shard, "baseline": baseline,
            "host": platform.node(), "cpu": platform.processor() or platform.machine(),
            "cores": os.cpu_count(), "platform": platform.platform(),
            "runtime": subprocess.run(["node", "-v"], capture_output=True, text=True)
                        .stdout.strip(),
            "generator": "blend.mjs/node", "epoch": 1, "suite": "blend-v1",
            "note": "co-located generator and target; not an admissible production run"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", required=True)
    ap.add_argument("--targets", required=True, help="comma separated, baseline first")
    ap.add_argument("--seconds", type=int, default=0, help="override rung duration")
    ap.add_argument("--rungs", default="", help="comma separated rung numbers, default all")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--skip-conform", action="store_true")
    ap.add_argument("--mode", choices=["local", "docker"], default="local")
    ap.add_argument("--validate-only", action="store_true",
                    help="boot and conform every target, then stop; no load is generated")
    a = ap.parse_args()

    rungs = [r for r in LADDER["rungs"]
             if not a.rungs or str(r["rung"]) in a.rungs.split(",")]
    secs = a.seconds or None
    wclass = warmup_class(a.shard)
    warm_s = LADDER["warmup"]["seconds"][wclass]
    if a.seconds:
        warm_s = max(5, a.seconds // 2)

    run_id = "%s.%s.%s" % (time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), a.shard, uuid.uuid4().hex[:6])
    out_path = ROOT / "results" / ("%s.jsonl" % run_id.replace(":", ""))
    out_path.parent.mkdir(exist_ok=True)
    baseline = MATRIX["languages"][a.shard]["baseline"]
    rows = [env_fingerprint(run_id, a.shard, baseline)]

    rows[0]["mode"] = a.mode
    if a.mode == "docker":
        rows[0]["cpus"] = Container.CPUS
    if a.validate_only:
        print("run %s   shard=%s  mode=%s  VALIDATE ONLY" % (run_id, a.shard, a.mode))
    else:
        print("run %s   shard=%s  mode=%s  warmup=%ss (%s)  rungs=%s"
              % (run_id, a.shard, a.mode, warm_s, wclass, [r["rung"] for r in rungs]))

    conformed = 0
    for target in a.targets.split(","):
        print("\n=== %s ===" % target)
        t = launcher(a.mode, a.shard, target).start()
        try:
            # `go run` compiles on first launch, which no boot budget should punish.
            try:
                wait_healthy(t, 240 if (a.mode == "local" and a.shard == "go")
                                else LADDER["boot_timeout_s"])
            except RuntimeError as e:
                print("  BOOT FAILED: %s" % e)
                if hasattr(t, "tail"):
                    print("  --- target log ---\n%s" % t.tail())
                continue
            print("  booted")
            if not a.skip_conform:
                ok, line = conform()
                print("  conformance: %s" % line)
                if not ok:
                    print("  FAILED: target does not conform")
                    continue
                conformed += 1
            if a.validate_only:
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
                                 "suite": "blend-v1", "arm": None, "shard": a.shard,
                                 "target": target, "rung": r["rung"], "offered_rps": r["rps"],
                                 "achieved_rps": res["achieved_rps"], "seconds": dur,
                                 "endpoint": ep["id"], "family": ep["family"],
                                 "count": ep["count"], "errors": ep["errors"],
                                 "mismatch": ep["mismatch"], "p50_us": ep["p50_us"],
                                 "p99_us": ep["p99_us"], "hist_b64": ep["hist_b64"]})
                rows.append({"kind": "rung", "run_id": run_id, "target": target,
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
    return 0

if __name__ == "__main__":
    sys.exit(main())
