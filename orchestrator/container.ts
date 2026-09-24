// container-h1: a framework's image, built from its own directory and run with a CPU budget
// imposed from outside, reached over HTTP/1.1.
//
// A recorded run builds from `git archive` of the framework's tree at the commit, so the image
// is made of exactly the files its bundleHash names. A development build sends the tracked files
// and the untracked ones git does not ignore, which is what someone iterating expects and still
// keeps bin/ and obj/ out.
//
// On Linux the framework is reached at the container's own bridge address, so no userland proxy
// and no NAT sit on the measured path. Docker Desktop cannot route to that address, so on macOS
// a loopback port is published instead, and a run there is never recorded.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import http2 from "node:http2";
import { join } from "node:path";

import { frameworkDir, frameworkId, type FrameworkKey } from "./bundle.ts";
import { git } from "./git.ts";
import type { HostId } from "./hosts.ts";

/** Inside the container every framework binds this, and nothing outside it has to know which. */
export const PORT = 8080;
export const PAYLOADS_IN_CONTAINER = "/rb/payloads";

export interface Built {
  readonly tag: string;
  /** What actually ran, as Docker names it. */
  readonly imageId: string;
  readonly imageBytes: number;
  /** The commit the context was archived at, or undefined for a working-tree build. */
  readonly commit: string | undefined;
}

export interface Address {
  readonly host: string;
  readonly port: number;
}

export interface Running {
  readonly name: string;
  readonly address: Address;
  /** How long `docker run` took to return, which is before the framework is ready. */
  readonly startMs: number;
  alive(): boolean;
  logs(lines?: number): string;
  stop(): void;
}

const docker = (args: readonly string[]): string =>
  execFileSync("docker", args, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Feeds a tar stream to `docker build`, from a producer command, and waits for both. */
function buildFrom(producer: { cmd: string; args: string[]; cwd: string; input?: string }, buildArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // COPYFILE_DISABLE stops macOS's tar adding an AppleDouble ._ file beside every file that
    // carries extended attributes, which a compiler globbing *.cs would then try to build.
    const tar = spawn(producer.cmd, producer.args, {
      cwd: producer.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, COPYFILE_DISABLE: "1" },
    });
    const build = spawn("docker", ["build", ...buildArgs, "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let err = "";
    tar.stderr.on("data", (d: Buffer) => (err += d.toString()));
    build.stderr.on("data", (d: Buffer) => (err += d.toString()));
    build.stdout.on("data", (d: Buffer) => (err += d.toString()));
    tar.stdout.pipe(build.stdin);
    // A side that stops reading early says why on stderr, which the close below reports.
    tar.stdin.on("error", () => {});
    build.stdin.on("error", () => {});
    tar.stdin.end(producer.input ?? "");
    let pending = 2;
    const done = (what: string) => (code: number | null) => {
      if (code !== 0) reject(new Error(`${what} exited ${code}: ${err.trim().split("\n").slice(-100).join("\n")}`));
      else if (--pending === 0) resolve();
    };
    tar.on("close", done(producer.cmd));
    build.on("close", done("docker build"));
    tar.on("error", reject);
    build.on("error", reject);
  });
}

export const tagOf = (f: FrameworkKey, host: HostId): string => `rb/${f.language}-${f.name}:${host}`;

export async function build(
  root: string,
  f: FrameworkKey,
  host: HostId,
  entry: { dockerfile: string; buildArgs?: Readonly<Record<string, string>> | undefined },
  at?: string,
): Promise<Built> {
  const dir = frameworkDir(f);
  const tag = tagOf(f, host);
  // Plain progress rather than -q, so a failed build's output ends with the failing step's own
  // errors, such as the compiler's.
  const args = ["--progress=plain", "-f", entry.dockerfile, "-t", tag, "--label", `rb.framework=${frameworkId(f)}`];
  for (const [k, v] of Object.entries(entry.buildArgs ?? {})) args.push("--build-arg", `${k}=${v}`);
  if (at !== undefined) {
    await buildFrom({ cmd: "git", args: ["archive", "--format=tar", `${at}:${dir}`], cwd: root }, args);
  } else {
    // Tracked files and untracked ones git does not ignore, relative to the framework.
    const files = git(root, ["ls-files", "-z", "-co", "--exclude-standard", "--", `${dir}/`])
      .split("\0")
      .filter((p) => p !== "")
      .map((p) => p.slice(dir.length + 1));
    // ustar, because Docker sniffs the first 512 bytes to tell a context from a Dockerfile, and a
    // pax header that macOS's tar writes for extended attributes cannot be read in 512.
    await buildFrom(
      { cmd: "tar", args: ["--format=ustar", "-c", "-f", "-", "--null", "-T", "-"], cwd: join(root, dir), input: files.join("\0") },
      args,
    );
  }
  const imageId = docker(["image", "inspect", "--format", "{{.Id}}", tag]);
  const imageBytes = Number(docker(["image", "inspect", "--format", "{{.Size}}", tag]));
  return { tag, imageId, imageBytes, commit: at };
}

export interface Budget {
  /** Cores the framework is placed on, from RB_SUT_CPUS. */
  readonly cpuset?: string | undefined;
  /** A quota, from RB_CPUS, where there is no cpuset to place onto. */
  readonly cpus: string;
}

/**
 * Where RB_SUT_CPUS names cores the framework is placed on them, with no quota on top: a quota
 * is enforced per 100 ms period, and a burst that spends it is throttled until the period rolls
 * over, which lands in p99 as the cgroup's jitter rather than the framework's.
 */
export function budget(env: NodeJS.ProcessEnv = process.env): Budget {
  const cpuset = env["RB_SUT_CPUS"]?.trim();
  return { ...(cpuset ? { cpuset } : {}), cpus: env["RB_CPUS"]?.trim() || "2" };
}

export function start(root: string, built: Built, f: FrameworkKey, host: HostId, b: Budget = budget()): Running {
  const name = `rb-${f.language}-${f.name}-${host}-${randomBytes(3).toString("hex")}`;
  const bridge = process.platform === "linux";
  const args = [
    "run",
    "-d",
    "--name",
    name,
    "-e",
    `PORT=${PORT}`,
    "-e",
    `RB_HOST=${host}`,
    "-e",
    `RB_PAYLOADS=${PAYLOADS_IN_CONTAINER}`,
    "-v",
    `${join(root, "tests", "payloads")}:${PAYLOADS_IN_CONTAINER}:ro`,
    ...(b.cpuset ? ["--cpuset-cpus", b.cpuset] : ["--cpus", b.cpus]),
    ...(bridge ? [] : ["-p", `127.0.0.1::${PORT}`]),
    built.tag,
  ];
  const t0 = performance.now();
  docker(args);
  const startMs = performance.now() - t0;
  // A framework that exited at once has no address to read back. Port 0 answers nothing, so
  // the probe goes on to find out it died and the log says why.
  const nowhere = { host: "127.0.0.1", port: 0 };
  let address: Address = nowhere;
  try {
    if (bridge) {
      const ip = docker(["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", name]);
      if (ip !== "") address = { host: ip, port: PORT };
    } else {
      const m = /:(\d+)$/.exec(docker(["port", name, `${PORT}/tcp`]).split("\n")[0]!);
      if (m !== null) address = { host: "127.0.0.1", port: Number(m[1]) };
    }
  } catch {
    address = nowhere;
  }
  return { name, address, startMs, ...handle(name) };
}

/** What a container host's framework is reached with. */
export type Spoken = "http/1.1" | "h2c";

/**
 * What Lambda puts in a function's environment. The Node, Java and .NET bootstraps size their heap
 * or their GC from the memory, and Lambda gives a function one vCPU at 1,769 MB. The Rust and Node
 * runtime clients refuse to start without some of the rest.
 */
/**
 * Where the traffic generator serves the Runtime API. On Linux the function shares the host's
 * network and reaches it on loopback. Elsewhere Docker Desktop's host.docker.internal reaches the
 * host, so it listens on every address.
 */
export const RUNTIME_API_BIND = process.platform === "linux" ? "127.0.0.1:0" : "0.0.0.0:0";

export const FUNCTION_ENV = {
  AWS_LAMBDA_FUNCTION_NAME: "rb",
  AWS_LAMBDA_FUNCTION_VERSION: "$LATEST",
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "1769",
  AWS_LAMBDA_LOG_GROUP_NAME: "/aws/lambda/rb",
  AWS_LAMBDA_LOG_STREAM_NAME: "rb",
  AWS_LAMBDA_INITIALIZATION_TYPE: "on-demand",
  AWS_REGION: "us-east-1",
  AWS_DEFAULT_REGION: "us-east-1",
} as const;

export interface RunningFunction {
  readonly name: string;
  /** How long `docker run` took to return, which is before the runtime asks for its first event. */
  readonly startMs: number;
  alive(): boolean;
  logs(lines?: number): string;
  stop(): void;
}

/**
 * lambda-emulator: the function's image, whose base image execs the runtime's bootstrap because
 * AWS_LAMBDA_RUNTIME_API is set, pointed at the Runtime API the traffic generator serves on
 * `apiPort`. On Linux it shares the host's network, so the runtime reaches the server over
 * loopback with no bridge or NAT on the path, and a function listens on nothing. It runs on one
 * core: the first of RB_SUT_CPUS, or a quota of one.
 */
export function startFunction(root: string, built: Built, f: FrameworkKey, host: HostId, apiPort: number, b: Budget = budget()): RunningFunction {
  const name = `rb-${f.language}-${f.name}-${host}-${randomBytes(3).toString("hex")}`;
  const linux = process.platform === "linux";
  const core = b.cpuset?.split(",")[0]?.split("-")[0];
  const args = [
    "run",
    "-d",
    "--name",
    name,
    ...(linux ? ["--network", "host"] : []),
    "-e",
    `AWS_LAMBDA_RUNTIME_API=${linux ? "127.0.0.1" : "host.docker.internal"}:${apiPort}`,
    ...Object.entries(FUNCTION_ENV).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    "-e",
    `RB_HOST=${host}`,
    "-e",
    `RB_PAYLOADS=${PAYLOADS_IN_CONTAINER}`,
    "-v",
    `${join(root, "tests", "payloads")}:${PAYLOADS_IN_CONTAINER}:ro`,
    ...(core ? ["--cpuset-cpus", core] : ["--cpus", "1"]),
    built.tag,
  ];
  const t0 = performance.now();
  docker(args);
  return { name, startMs: performance.now() - t0, ...handle(name) };
}

/** Asking after a container, reading its log and stopping it, by its name. */
function handle(name: string): Pick<RunningFunction, "alive" | "logs" | "stop"> {
  return {
    alive: () => {
      try {
        return docker(["inspect", "-f", "{{.State.Running}}", name]) === "true";
      } catch {
        return false;
      }
    },
    // Both streams: most frameworks write why they would not start to stderr.
    logs: (lines = 40) => {
      const r = spawnSync("docker", ["logs", "--tail", String(lines), name], { encoding: "utf8" });
      return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    },
    stop: () => {
      try {
        docker(["stop", "-t", "3", name]);
      } catch {
        // already gone
      }
      try {
        docker(["rm", "-f", name]);
      } catch {
        // already gone
      }
    },
  };
}

/** One GET, with the whole of the time left to answer it. */
function getOnce(address: Address, path: string, timeoutMs: number, protocol: Spoken): Promise<{ status: number; body: Buffer }> {
  if (protocol === "h2c") return getOnceH2(address, path, timeoutMs);
  return new Promise((resolve, reject) => {
    const req = http.get({ host: address.host, port: address.port, path, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(Math.max(1, timeoutMs), () => req.destroy(new Error("timed out")));
  });
}

/** One GET over HTTP/2 with prior knowledge, on a connection of its own. */
function getOnceH2(address: Address, path: string, timeoutMs: number): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const session = http2.connect(`http://${address.host}:${address.port}`);
    const fail = (error: Error) => {
      session.destroy();
      reject(error);
    };
    session.on("error", fail);
    const req = session.request({ ":method": "GET", ":path": path });
    let status = 0;
    const chunks: Buffer[] = [];
    req.on("response", (headers) => (status = Number(headers[":status"])));
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      session.close();
      resolve({ status, body: Buffer.concat(chunks) });
    });
    req.on("error", fail);
    req.setTimeout(Math.max(1, timeoutMs), () => fail(new Error("timed out")));
    req.end();
  });
}

export interface Ready {
  /** From `docker run` returning to the first 200 from /health. */
  readonly readyMs: number;
  /** How long the probe that got that 200 took, which is the first request the framework answered. */
  readonly probeMs: number;
}

/**
 * Wait for a 200 with a body from /health, not merely for the port to accept, because a
 * published port accepts before the process inside has bound. The interval is 2% of the time
 * already waited, from 1 to 50 ms: a native framework boots in milliseconds and a JVM in
 * seconds, and any fixed interval is too coarse for one or wasteful on the other.
 */
export async function probe(address: Address, budgetMs: number, alive: () => boolean, protocol: Spoken = "http/1.1"): Promise<Ready> {
  const t0 = performance.now();
  const deadline = t0 + budgetMs;
  let checked = t0;
  for (;;) {
    const now = performance.now();
    if (now >= deadline) throw new Error(`no 200 from /health within ${Math.round(budgetMs / 1000)} s`);
    // Asking Docker costs tens of milliseconds, so once a second is soon enough to stop
    // waiting on a framework that died.
    if (now - checked >= 1000) {
      if (!alive()) throw new Error("the framework exited before it answered /health");
      checked = now;
    }
    const sent = performance.now();
    try {
      const r = await getOnce(address, "/health", deadline - sent, protocol);
      if (r.status === 200 && r.body.length > 0) {
        const done = performance.now();
        return { readyMs: done - t0, probeMs: done - sent };
      }
    } catch {
      // not listening yet
    }
    const waited = performance.now() - t0;
    await new Promise((r) => setTimeout(r, Math.min(50, Math.max(1, waited * 0.02))));
  }
}

/** What the framework says it is, verbatim. Not measured and not checked: an empty object when it says nothing. */
export async function meta(address: Address, protocol: Spoken = "http/1.1"): Promise<Record<string, unknown>> {
  try {
    const r = await getOnce(address, "/__meta", 5000, protocol);
    if (r.status !== 200) return {};
    const parsed: unknown = JSON.parse(r.body.toString("utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
