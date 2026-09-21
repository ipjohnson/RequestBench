import type { Json, RunValues, Schema } from "./types.ts";

/**
 * A body the corpus knows exactly. A test names the one it expects and the
 * validating client compares the whole answer against it, so a framework that
 * answers the right shape with the wrong values fails.
 *
 * The format says how an answer is compared. `json` compares the parsed value, so
 * key order and a number written 18928 or 18928.0 stop mattering. `lines` is one
 * JSON value per line. `text` is byte for byte. `html` removes whitespace at
 * element boundaries and collapses it inside text, because template engines
 * cannot agree on indentation.
 */
export interface Payload<T = unknown> {
  /** What the body is, as a failure and the endpoint page name it. */
  readonly name: string;
  readonly format: "json" | "lines" | "text" | "html";
  readonly value: T;
  /** The model a json payload matches, which the OpenAPI document gives as the body's schema. */
  readonly model?: Schema<unknown, T> | undefined;
  /**
   * The payloads a computed answer is made from, which the OpenAPI document links to.
   * A payload made from none is a committed file, or a literal.
   */
  readonly from?: readonly Payload[] | undefined;
}

/** What a computed payload matches and is made from. Neither is checked here. */
export interface Made<T> {
  readonly model?: Schema<unknown, T>;
  readonly from?: readonly Payload[];
}

export interface BodyOptions {
  /** true: the body arrived gzip-encoded. false: it arrived with no content coding. Left out: either. */
  readonly compressed?: boolean;
  /**
   * Run values the handler bound, which the answer carries back in an `echo`
   * object beside the payload's own fields. The keys are the run values' names.
   */
  readonly echo?: readonly (keyof RunValues)[];
}

/**
 * A payload read from its committed file, checked against its model here. A
 * file that stops matching its own shape fails when the corpus loads rather than
 * in whichever row serves it first.
 */
export function payload<O>(name: string, model: Schema<unknown, O>, value: unknown, from?: readonly Payload[]): Payload<O> {
  const checked = model["~standard"].validate(value);
  if (checked instanceof Promise) throw new Error(`payload ${name}: the model is async`);
  if (checked.issues) {
    const at = (path: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined) =>
      (path ?? []).map((p) => String(typeof p === "object" ? p.key : p)).join(".") || "the value";
    const issues = checked.issues.slice(0, 3).map((i) => `${at(i.path)}: ${i.message}`);
    throw new Error(`payload ${name} does not match its model: ${issues.join("; ")}`);
  }
  return { name, format: "json", value: frozen(checked.value), model, from };
}

/**
 * A JSON body made from payloads already checked, such as one of their rows.
 * Not checked again, because a test may build one for every request it sends.
 */
export function json<T extends Json>(name: string, value: T, made: Made<T> = {}): Payload<T> {
  return { name, format: "json", value, model: made.model, from: made.from };
}

/** One JSON value per line. */
export function lines(name: string, rows: readonly Json[], from?: readonly Payload[]): Payload<readonly Json[]> {
  return { name, format: "lines", value: rows, from };
}

export function text(name: string, value: string): Payload<string> {
  return { name, format: "text", value };
}

export function html(name: string, value: string, from?: readonly Payload[]): Payload<string> {
  return { name, format: "html", value, from };
}

/**
 * Every test hands the same objects to every client, and the measured client
 * serialises a request body once per object, so an object changed after that
 * would go on the wire as it was.
 */
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
}
