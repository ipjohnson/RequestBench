import type { Schema, SchemaIssue } from "./types.ts";

/**
 * How one framework's error bodies are read. The type parameter lives on the
 * factory, where it types the author's readers, and is gone from the value, so
 * the registry that holds all of them needs no parameter of its own.
 */
export interface Exceptions {
  readonly about: string;
  /** The status this framework refuses a bad body with. 400 for most, 422 for pydantic. */
  readonly rejected: number;
  /**
   * The status for a body that never parsed. Often not the same number: a
   * framework whose validator answers 422 may still answer 400 when the JSON
   * itself is broken, because the validator never ran.
   */
  readonly malformed: number;
  readonly notFound: number;
  /**
   * The status for a path that has a route, asked with a method it does not have.
   * 405 in ASP.NET Core and Starlette. Express, Fastify and Gin answer 404 unless
   * told otherwise, because their routers match the method and the path together.
   */
  readonly wrongMethod: number;
  /** Whether a bad body naming two fields answers with both, or stops at the first. */
  readonly reports: "all" | "first";
  /**
   * Parse an error body with the declared envelope and read it. This is the
   * point where a framework is held to its declaration: an envelope that moved
   * under an upgrade throws here instead of quietly reporting no fields in
   * every rejection row for the rest of the year.
   */
  read(body: unknown): Rejection;
}

export interface Rejection {
  readonly fields: readonly string[];
  message(field: string): string | undefined;
}

export class EnvelopeMismatch extends Error {
  readonly about: string;
  readonly issues: readonly SchemaIssue[];

  constructor(about: string, issues: readonly SchemaIssue[]) {
    const at = (i: SchemaIssue) => (i.path ?? []).map((p) => String(typeof p === "object" ? p.key : p)).join(".");
    super(`error body does not match the declared envelope: ${issues.map((i) => (at(i) ? `${at(i)}: ${i.message}` : i.message)).join("; ")}`);
    this.name = "EnvelopeMismatch";
    this.about = about;
    this.issues = issues;
  }
}

export function exceptions<B>(d: {
  about: string;
  rejected: number;
  malformed?: number;
  notFound: number;
  wrongMethod: number;
  reports?: "all" | "first";
  envelope: Schema<unknown, B>;
  fields: (body: B) => string[];
  message: (body: B, field: string) => string | undefined;
}): Exceptions {
  return {
    about: d.about,
    rejected: d.rejected,
    malformed: d.malformed ?? d.rejected,
    notFound: d.notFound,
    wrongMethod: d.wrongMethod,
    reports: d.reports ?? "all",
    read(body) {
      const parsed = d.envelope["~standard"].validate(body);
      if (parsed instanceof Promise) throw new Error(`${d.about}: the envelope schema is async`);
      if (parsed.issues) throw new EnvelopeMismatch(d.about, parsed.issues);
      const value = parsed.value;
      return { fields: d.fields(value), message: (f) => d.message(value, f) };
    },
  };
}

/**
 * The normal form every declaration maps onto, and every test is written
 * against: the name as it goes on the wire, dotted, a list index as its own
 * segment.
 */
export function field(...parts: readonly (string | number)[]): string {
  return parts.map(String).join(".");
}

/** `["body", "items", 0, "qty"]` from a pydantic loc, minus its source segment. */
export function fromLoc(loc: readonly (string | number)[]): string {
  return field(...loc.slice(1));
}

/** `Lines[0].ProductId` -> `lines.0.productId` */
export function fromClr(key: string): string {
  const segments = key.replace(/\[(\d+)\]/g, ".$1").split(".");
  return field(...segments.map((seg) => seg.charAt(0).toLowerCase() + seg.slice(1)));
}

/** `lines.0.productId` -> `Lines[0].ProductId` */
export function toClr(f: string): string {
  return f
    .split(".")
    .map((seg, i) => (/^\d+$/.test(seg) ? `[${seg}]` : (i === 0 ? "" : ".") + seg[0]!.toUpperCase() + seg.slice(1)))
    .join("");
}

/**
 * A JSON pointer -> the normal form. ajv's `instancePath` is already relative to
 * the validated object; a fastify message carries the source in front of it, so
 * the declaration strips that first.
 */
export function fromPointer(pointer: string): string {
  return field(...pointer.replace(/^\//, "").split("/"));
}
