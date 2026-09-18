// rb:test *
/**
 * What every test asserts before it asserts anything of its own.
 *
 * A port of difference() in client/src/expectation.ts, in its order and with its rules. The
 * order is the point: a target answering the right values as text/plain is not answering
 * correctly, so the kind of body is checked before the body. A suite stricter than the
 * client fails a target the client passes, and a looser one passes a target `make test`
 * rejects.
 */
import { gunzipSync } from "node:zlib";

/** Assert the pinned answer, or fail naming the first thing that differs. */
export function check(a, answer) {
  const why = difference(a.want, answer);
  if (why) throw new Error(`${a.key}: ${why}`);
}

export function difference(want, answer) {
  if (answer.status !== want.status) return `expected ${want.status}, got ${answer.status}`;
  // A null is a field spec/expected.json deliberately does not pin; its "unpinned" block
  // says which. compressed.gzip_small is the one this suite meets.
  const got = bodyClass(answer.contentType);
  if (want.body_class !== null && got !== want.body_class) {
    return `expected a ${want.body_class} body, got ${got}`;
  }
  if (want.encoding !== null && answer.encoding !== want.encoding) {
    return `expected content-encoding ${want.encoding || "identity"}, got ${answer.encoding || "identity"}`;
  }
  return firstDifference(comparable(decoded(answer), answer.contentType), want.body);
}

export function bodyClass(contentType) {
  const ctype = (contentType ?? "").toLowerCase();
  if (ctype.includes("json")) return "json";
  if (ctype.includes("html")) return "html";
  if (ctype.includes("text")) return "text";
  return ctype === "" ? "none" : "other";
}

/**
 * gzip output differs between zlib, Java's Deflater and Go's compress/flate at the same
 * level. The decompressed bytes must not, so the comparison is taken over those.
 */
function decoded({ raw, encoding }) {
  if (raw.length > 0 && encoding.includes("gzip")) {
    try { return gunzipSync(raw); } catch { return raw; }
  }
  return raw;
}

/** The response as a value rather than as bytes, so key order and 18928.0 stop mattering. */
function comparable(raw, contentType = "") {
  if (raw.length === 0) return null;
  if (contentType.includes("json")) {
    try { return JSON.parse(raw.toString("utf8")); } catch { return "unparseable-json"; }
  }
  let text = raw.toString("utf8");
  if (contentType.includes("html")) {
    // Five template engines cannot agree on formatting, so the spec pins content and leaves
    // whitespace free: same elements, same order, same values.
    text = text.replace(/[ \t\n\r\f\v]+/g, " ").replace(/>[ ]+/g, ">").replace(/[ ]+</g, "<").trim();
  }
  return text;
}

const typeName = (v) => v === null ? "NoneType" : Array.isArray(v) ? "list"
  : typeof v === "object" ? "dict" : typeof v === "string" ? "str" : typeof v === "boolean" ? "bool"
  : typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v;

export function firstDifference(a, b, path = "response") {
  const ta = typeName(a), tb = typeName(b);
  if (ta !== tb && !(typeof a === "number" && typeof b === "number")) return `${path}: ${ta} vs ${tb}`;
  if (ta === "dict") {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!(k in a)) return `${path}.${k}: missing here, present in the reference`;
      if (!(k in b)) return `${path}.${k}: present here, missing in the reference`;
      const d = firstDifference(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  if (ta === "list") {
    if (a.length !== b.length) return `${path}: ${a.length} items vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
// rb:end
