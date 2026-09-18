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
import { inHeader, inPath, type Values } from "./values.js";
import type { Answer } from "@rb/schema";

const EMPTY = Buffer.alloc(0);

/** One request and what came back, before anything has judged it. */
export type Visit = {
  /** As it was sent, with this run's values in it. */
  readonly path: string;
  /** As the plan writes it, which is what an expectation and a reference are keyed by. */
  readonly planned: string;
  /** The headers this request actually carried, captures resolved and variant chosen. */
  readonly sent: Readonly<Record<string, string>>;
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
  /**
   * Why nothing was sent for this endpoint, or null.
   *
   * Only one thing produces it: a capture the target would not give up. The request cannot
   * be built without the value, and sending it with the placeholder still in would ask a
   * conditional question with a validator no target could ever match, which reads as the
   * target answering the wrong status rather than as the missing header it is.
   */
  readonly why: string | null;
};

/** What the plan says an endpoint's request carries, before a capture is resolved. */
const placeholder = /\{capture\.([a-z_]+)\}/g;

/**
 * One header set with every {capture.<name>} filled in, or the reason it cannot be.
 *
 * A capture is resolved once per target per process. The tag is constant for as long as the
 * body is, so re-reading it per request would measure the extra request.
 */
export function fill(
  headers: Readonly<Record<string, string>>, captures: ReadonlyMap<string, string>,
): { headers: Record<string, string>; why: string | null } {
  const out: Record<string, string> = {};
  let why: string | null = null;
  for (const [name, value] of Object.entries(headers)) {
    out[name] = value.replace(placeholder, (whole, ref: string) => {
      const got = captures.get(ref);
      if (got === undefined) {
        why ??= `capture ${ref} was never resolved, so ${name} cannot be sent`;
        return whole;
      }
      return got;
    });
  }
  return { headers: out, why };
}

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
  /** This run's values, filled in wherever the plan carries a {run.<name>}. */
  readonly values?: Values;
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

/**
 * The same request gen/blend.mjs sends: the endpoint's headers with this run's values in
 * them, and a type when there is a body. `instance` picks the vary combination, the way the
 * generator picks it from the instance it drew.
 */
export const requestHeaders = (
  ep: PlanEndpoint, instance = 0, values: Values = new Map(),
): Record<string, string> => {
  // The gate used to add an accept the generator never sends, which meant a
  // content-negotiating target could be gated on one response and measured on another.
  const variants = ep.header_variants;
  const headers: Record<string, string> = {
    ...(ep.headers ?? {}),
    ...(variants?.length ? variants[instance % variants.length] : {}),
  };
  for (const [name, value] of Object.entries(headers)) headers[name] = inHeader(value, values);
  if (ep.body) headers["content-type"] = "application/json";
  return headers;
};

export class Replay {
  private readonly conn: Transport;
  private captured: Map<string, string> | null = null;

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
   * The header values only this target can supply, read off one response each.
   *
   * spec/plan.json pre-resolves every other request header, because the same bytes have to
   * reach every target. A matching If-None-Match cannot be one of them: the etag family
   * lets each framework's own machinery compute the validator, so the value is whatever
   * this target answered and nothing committed can hold it. A capture that does not come
   * back is not a transport failure, it is the target not emitting the header, so it is
   * recorded rather than thrown and the endpoints that need it fail by name.
   */
  async captures(): Promise<Map<string, string>> {
    if (this.captured) return this.captured;
    const out = new Map<string, string>();
    for (const [name, cap] of Object.entries(this.plan.captures ?? {})) {
      try {
        const r = await this.conn.send(cap.method, cap.path, undefined, {});
        const want = cap.header.toLowerCase();
        const got = r.headers.find(([k]) => k.toLowerCase() === want)?.[1];
        if (got !== undefined) out.set(name, got);
      } catch {
        this.conn.reset();
      }
    }
    this.captured = out;
    return out;
  }

  /**
   * Every endpoint in the plan, with what each of its instances answered.
   *
   * One endpoint at a time rather than the whole plan at once: an endpoint has up to 512
   * instances and the consumer is done with them before the next endpoint starts, so only one
   * endpoint's responses are held.
   */
  async *endpoints(): AsyncGenerator<Replayed> {
    const captured = await this.captures();
    const values = this.opts.values ?? new Map<string, number | string>();
    for (const ep of this.plan.endpoints) {
      const drawn = this.opts.instances ? ep.paths.slice(0, this.opts.instances) : ep.paths;
      const paths = this.opts.distinct ? [...new Set(drawn)] : drawn;
      // Built per instance rather than once, because the vary rows send a different
      // combination on each: a response cache keyed on a header it never sees vary is
      // keyed on nothing. Every other endpoint has one combination and this is that one.
      const filled = paths.map((_, i) => fill(requestHeaders(ep, i, values), captured));
      const why = filled.find((f) => f.why)?.why ?? null;
      if (why) { yield { ep, visits: [], why }; continue; }
      const visits: Visit[] = [];
      for (const [i, planned] of paths.entries()) {
        const headers = (filled[i] as { headers: Record<string, string> }).headers;
        const path = inPath(planned, values);
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
          planned,
          sent: headers,
          status: reply?.status ?? 0,
          raw: reply?.body ?? EMPTY,
          headers: reply?.headers ?? [],
          contentType: reply?.contentType,
          transportError,
        });
      }
      yield { ep, visits, why: null };
    }
  }

  close(): void {
    this.conn.close();
  }
}
