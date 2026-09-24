// The pipe to the traffic generator's Rust program, in src/, which speaks every protocol and
// times every load. The corpus stays in TypeScript: priming and the gate hand the program one
// request at a time, and cli.ts hands it the compiled load, a phase at a time. src/main.rs lists
// the lines that go each way.
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";

/** A request as the corpus sends it, before any protocol. The program adds the host and the framing. */
export interface WireRequest {
  readonly method: string;
  /** The path with its query string, percent-encoded. */
  readonly target: string;
  /** In the order the test set them. */
  readonly headers: readonly (readonly [string, string])[];
  /** In base64. Absent when the request carries no body. */
  readonly body?: string;
}

/** An answer as the framework wrote it. */
export interface Exchanged {
  readonly status: number;
  readonly reason: string;
  readonly version: string;
  /** What the request's Host header said. */
  readonly host: string;
  /** Names as the framework spelled them, in the order it wrote them. */
  readonly headers: readonly (readonly [string, string])[];
  /** With any chunk framing off and any content coding still on. */
  readonly body: Buffer;
  readonly bodyBytes: number;
}

/** One instance as the load sends it, which prepare.ts compiled. */
export interface LoadInstance {
  readonly request: WireRequest;
  /** The method and target, as a mismatch line names them. */
  readonly label: string;
  readonly accepted: readonly number[];
  readonly bodyBytes: number | null;
}

/** A tally as the program writes it: its histogram in histogram.ts's layout, as base64. */
export interface WireTally {
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly dropped: number;
  readonly hist: string;
  readonly firstError: string | null;
  readonly firstMismatch: string | null;
}

/** One phase, every thread's tallies merged. Times are nanoseconds on the program's own clock. */
export interface PhaseReport {
  readonly aborted: boolean;
  readonly start: number;
  /** When the last instance finished, or 0 when none did. */
  readonly last: number;
  readonly unfinished: number;
  readonly settle: WireTally;
  /** In the order the load listed the tests. */
  readonly tests: readonly WireTally[];
}

let built: string | undefined;

/**
 * The program, which cargo builds the first time a process asks for it, and finds current after
 * that. cargo runs in the program's own directory, because that is where rustup reads the
 * toolchain it is pinned to.
 */
export function program(root: string): string {
  if (built !== undefined) return built;
  const r = spawnSync("cargo", ["build", "--release", "--locked", "--quiet"], {
    cwd: join(root, "traffic-generator"),
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (r.error !== undefined || r.status !== 0) {
    throw new Error(`cargo could not build the traffic generator: ${r.error?.message ?? `it exited ${r.status}`}`);
  }
  built = join(root, "traffic-generator", "target", "release", "traffic-generator");
  return built;
}

const ROOT = join(import.meta.dirname, "..");

type Line = { id?: number; answer?: Record<string, unknown>; error?: string; kind?: string; message?: string };

export class Pipe {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #exchanges = new Map<number, { resolve: (a: Exchanged) => void; reject: (e: Error) => void }>();
  /** The command other than an exchange that is waiting for its line. One runs at a time. */
  #waiting: { resolve: (line: Line) => void; reject: (e: Error) => void } | undefined;
  #next = 0;
  #ended: Error | undefined;

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.#child = child;
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr = `${stderr}${chunk.toString()}`.slice(-4000)));
    createInterface({ input: child.stdout }).on("line", (text) => {
      try {
        this.#line(JSON.parse(text) as Line);
      } catch {
        stderr = `${stderr}${text}\n`.slice(-4000);
      }
    });
    child.on("exit", (code, signal) => {
      this.#ended = new Error(`the traffic generator exited with ${signal ?? code}${stderr === "" ? "" : `: ${stderr.trim()}`}`);
      for (const pending of this.#exchanges.values()) pending.reject(this.#ended);
      this.#exchanges.clear();
      this.#waiting?.reject(this.#ended);
      this.#waiting = undefined;
    });
  }

  /** The program, reaching the framework at this address. */
  static start(address: { readonly host: string; readonly port: number }, root: string = ROOT): Pipe {
    const child = spawn(program(root), ["--target", `${address.host}:${address.port}`], { stdio: ["pipe", "pipe", "pipe"] });
    return new Pipe(child);
  }

  /** One request and its whole answer. Nothing about it is timed. */
  exchange(request: WireRequest, timeoutMs = 10_000): Promise<Exchanged> {
    if (this.#ended !== undefined) return Promise.reject(this.#ended);
    const id = ++this.#next;
    return new Promise((resolve, reject) => {
      this.#exchanges.set(id, { resolve, reject });
      this.#send({ op: "exchange", id, request, timeoutMs });
    });
  }

  /** Builds every instance into its bytes and opens the load's connections. */
  async open(tests: readonly { readonly instances: readonly LoadInstance[] }[], workers: number, connections: number): Promise<void> {
    await this.#command({ op: "open", tests, workers, connections }, "ready");
  }

  async phase(phase: { rps: number; settle: number; total: number; abortDropFraction: number | null }): Promise<PhaseReport> {
    return (await this.#command({ op: "phase", ...phase }, "phase")) as unknown as PhaseReport;
  }

  /** Ends the program, and waits for it to go. */
  async close(): Promise<void> {
    if (this.#ended !== undefined) return;
    const gone = new Promise<void>((resolve) => this.#child.once("exit", () => resolve()));
    this.#child.stdin.end();
    await gone;
  }

  #send(command: object): void {
    this.#child.stdin.write(`${JSON.stringify(command)}\n`);
  }

  #command(command: object, kind: string): Promise<Line> {
    if (this.#ended !== undefined) return Promise.reject(this.#ended);
    if (this.#waiting !== undefined) return Promise.reject(new Error("the traffic generator is already running a command"));
    return new Promise<Line>((resolve, reject) => {
      this.#waiting = { resolve, reject };
      this.#send(command);
    }).then((line) => {
      if (line.kind === "error" || line.kind !== kind) throw new Error(`traffic generator: ${line.message ?? `answered ${line.kind}`}`);
      return line;
    });
  }

  #line(line: Line): void {
    if (line.id !== undefined) {
      const pending = this.#exchanges.get(line.id);
      if (pending === undefined) return;
      this.#exchanges.delete(line.id);
      if (line.error !== undefined) return pending.reject(new Error(line.error));
      const a = line.answer as Omit<Exchanged, "body"> & { body: string };
      pending.resolve({ ...a, body: Buffer.from(a.body, "base64") });
      return;
    }
    const waiting = this.#waiting;
    this.#waiting = undefined;
    waiting?.resolve(line);
  }
}
