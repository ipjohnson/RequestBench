// How two responses are compared: as parsed values, not as bytes.
//
// Ported from harness/conform.py. The message strings and the Python type names are
// reproduced on purpose so the two implementations can be run against the same target and
// diffed line for line while both exist. Once the Python is gone this can say "object"
// instead of "dict" and nothing will care.

/** A response body after `comparable()`: parsed JSON, normalised text, or null. */
export type Comparable = unknown;

// Python's `\s` on bytes is ASCII-only. JavaScript's is not, and would collapse a
// non-breaking space inside rendered content that the Python side keeps.
const ASCII_WS = /[ \t\n\r\f\v]+/g;

/**
 * The response as a value rather than as bytes.
 *
 * Key order follows whatever the language's serializer does and a number can come back
 * 18928 or 18928.0, so parsing first makes those stop mattering. It also makes a mismatch
 * legible: the failure names the field that differs instead of two digests that do not.
 */
export function comparable(raw: Buffer, contentType: string | undefined): Comparable {
  if (raw.length === 0) return null;
  const ctype = contentType ?? "";
  if (ctype.includes("json")) {
    try {
      return JSON.parse(raw.toString("utf8")) as unknown;
    } catch {
      return "unparseable-json";
    }
  }
  let text = raw.toString("utf8");
  if (ctype.includes("html")) {
    // Five template engines cannot agree on formatting without every template being
    // contorted to match, so the spec pins content and leaves whitespace free: same
    // elements, same order, same values.
    //
    // Collapsing runs is not enough on its own. It leaves an engine's indentation as a
    // space where a string concat has nothing, so the two still differ and no engine could
    // ever match. Whitespace at an element boundary goes entirely; whitespace inside text
    // is collapsed and kept, because there it is content.
    text = text.replace(ASCII_WS, " ").replace(/>[ ]+/g, ">").replace(/[ ]+</g, "<").trim();
  }
  return text;
}

/** Python's type() name for a JSON value, so a mismatch line reads the same in both. */
function typeName(v: unknown): string {
  if (v === null) return "NoneType";
  if (Array.isArray(v)) return "list";
  switch (typeof v) {
    case "object": return "dict";
    case "string": return "str";
    case "boolean": return "bool";
    case "number": return Number.isInteger(v) ? "int" : "float";
    default: return typeof v;
  }
}

/** Python's repr() for a JSON scalar, near enough to diff the two outputs by eye. */
function repr(v: unknown): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "string") return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return JSON.stringify(v) ?? String(v);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Where two parsed responses stop agreeing, as something a person can act on, or null.
 *
 * `a` is what the target answered and `b` is the expectation.
 *
 * One deliberate difference from the Python: there, `bool` is a subclass of `int`, so a
 * target answering 1 where the expectation says true compares equal and passes. Here it
 * fails. That can only turn a Python pass into a failure, and when it fires the target is
 * wrong.
 */
export function firstDifference(a: unknown, b: unknown, path = "response"): string | null {
  const ta = typeName(a), tb = typeName(b);
  // int against float is not a difference: the same number can come back either way.
  const bothNumbers = typeof a === "number" && typeof b === "number";
  if (ta !== tb && !bothNumbers) return `${path}: ${ta} vs ${tb}`;

  if (isPlainObject(a) && isPlainObject(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!(k in a)) return `${path}.${k}: missing here, present in the reference`;
      if (!(k in b)) return `${path}.${k}: present here, missing in the reference`;
      const d = firstDifference(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: ${a.length} items vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${repr(a)} vs ${repr(b)}`;
}
