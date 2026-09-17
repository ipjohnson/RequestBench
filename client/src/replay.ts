// One replay, two authorities.
//
// harness/conform.py and tests/ both sent spec/plan.json at a booted target and compared what
// came back. They differed only in what they compared against, and that difference is worth
// keeping: the gate checks a target against another target measured in the same run, the
// expectation checks it against a committed file, and agreement between two frameworks is not
// evidence either is right. Two implementations of the sending was not worth keeping.
import { comparable } from "./compare.js";
import { bodyClass, contentEncoding, decoded, type Encoding, type Header } from "./checks.js";
import type { PlanEndpoint, Plan } from "./spec.js";
import { Transport, type Reply } from "./http.js";
import type { Answer } from "@rb/schema";

const EMPTY = Buffer.alloc(0);

/** One request and what came back, before anything has judged it. */
export type Visit = {
  readonly path: string;
  /** 0 when nothing arrived. */
  readonly status: number;
  /** As it came off the wire, still compressed if it was sent that way. */
  readonly raw: Buffer;
  readonly headers: readonly Header[];
  readonly contentType: string | undefined;
  readonly transportError: string | null;
};

export type Replayed = {
  readonly ep: PlanEndpoint;
  readonly visits: readonly Visit[];
};

export type ReplayOptions = {
  /** 0 or absent = every instance. */
  readonly instances?: number;
  readonly encoding?: Encoding;
  /**
   * Ask each distinct path once instead of once per instance.
   *
   * The expectation is one entry per distinct request, so asking /domain/orders/602 all the
   * times the plan draws it proves nothing it did not prove the first time. The gate does
   * want every instance: x-rb-serial has to advance across them.
   */
  readonly distinct?: boolean;
};

/**
 * The response as the thing both authorities judge: status, kind of body, whether it arrived
 * compressed, and the body as a value rather than as bytes.
 *
 * `encoding` is here because the body below it is the decompressed one. Without it the
 * compressed family would prove only that a target answered the right JSON, and a target that
 * quietly stopped compressing would pass.
 */
export const answerOf = (v: Visit): Answer => ({
  status: v.status,
  body_class: bodyClass(v.contentType),
  encoding: contentEncoding(v.headers),
  body: comparable(decoded(v.raw, v.headers), v.contentType),
});

/** The same request gen/blend.mjs sends: the endpoint's headers, and a type when there is a body. */
export const requestHeaders = (ep: PlanEndpoint): Record<string, string> => {
  // The gate used to add an accept the generator never sends, which meant a
  // content-negotiating target could be gated on one response and measured on another.
  const headers: Record<string, string> = { ...(ep.headers ?? {}) };
  if (ep.body) headers["content-type"] = "application/json";
  return headers;
};

export class Replay {
  private readonly conn: Transport;

  constructor(
    private readonly plan: Plan,
    hostport: string,
    private readonly opts: ReplayOptions = {},
  ) {
    this.conn = new Transport(hostport, opts.encoding ?? "http");
  }

  /** What the target says it is. Absent is not a failure: not every host serves it. */
  async meta(): Promise<Record<string, unknown>> {
    try {
      const r = await this.conn.send("GET", "/__meta", undefined, {});
      return JSON.parse(r.body.toString("utf8")) as Record<string, unknown>;
    } catch {
      this.conn.reset();
      return {};
    }
  }

  /**
   * Every endpoint in the plan, with what each of its instances answered.
   *
   * One endpoint at a time rather than the whole plan at once: an endpoint has up to 512
   * instances and the consumer is done with them before the next endpoint starts, so only one
   * endpoint's responses are held.
   */
  async *endpoints(): AsyncGenerator<Replayed> {
    for (const ep of this.plan.endpoints) {
      const drawn = this.opts.instances ? ep.paths.slice(0, this.opts.instances) : ep.paths;
      const paths = this.opts.distinct ? [...new Set(drawn)] : drawn;
      const headers = requestHeaders(ep);
      const visits: Visit[] = [];
      for (const path of paths) {
        let reply: Reply | null = null;
        let transportError: string | null = null;
        try {
          reply = await this.conn.send(ep.method, path, ep.body, headers);
        } catch (e) {
          this.conn.reset();
          transportError = `transport:${(e as Error).name}`;
        }
        visits.push({
          path,
          status: reply?.status ?? 0,
          raw: reply?.body ?? EMPTY,
          headers: reply?.headers ?? [],
          contentType: reply?.contentType,
          transportError,
        });
      }
      yield { ep, visits };
    }
  }

  close(): void {
    this.conn.close();
  }
}
