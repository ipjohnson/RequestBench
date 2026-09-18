// rb:test authorized.*,body.*,errors.*
/**
 * What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.
 *
 * A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
 * envelope is the framework's own contract, so what is held is the status, the kind of body,
 * and the shape this target recorded: the envelope with the values taken out.
 *
 * The framework-agnostic `errors` block is deliberately not what this reads. That block says
 * what the plan intends, and a framework may declare otherwise in the client-exception
 * package beside it, which the conformance client reads. A suite reads what this target
 * recorded instead.
 */
import { bodyClass } from "./floor.js";
import { envelope } from "./planned.js";

export function check(a, answer, target) {
  const recorded = envelope(target, a.key);
  if (!recorded) throw new Error(`${a.key}: spec/expected.json records no envelope for ${target}`);
  if (answer.status !== recorded.status) throw new Error(`${a.key}: expected ${recorded.status}, got ${answer.status}`);
  const got = bodyClass(answer.contentType);
  if (got !== recorded.body_class) throw new Error(`${a.key}: expected a ${recorded.body_class} body, got ${got}`);
  let body = null;
  if (answer.body.length > 0) {
    try { body = JSON.parse(answer.body.toString("utf8")); } catch { body = "unparseable-json"; }
  }
  const have = shapeOf(body), want = new Set(recorded.shape);
  const missing = [...want].filter((s) => !have.has(s)).sort();
  const added = [...have].filter((s) => !want.has(s)).sort();
  if (missing.length || added.length) {
    throw new Error(`${a.key}: the envelope shape moved: missing ${missing}, added ${added}`);
  }
}

/** A port of shape_of() in harness/expected.py, which is what wrote the recorded shapes. */
export function shapeOf(node, path = "") {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    const keys = Object.keys(node);
    if (keys.length === 0) return new Set([`${path}{}`]);
    return new Set(keys.flatMap((k) => [...shapeOf(node[k], path ? `${path}.${k}` : k)]));
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return new Set([`${path}[]`]);
    return new Set(node.flatMap((v) => [...shapeOf(v, `${path}[]`)]));
  }
  const kind = node === null ? "null" : typeof node === "string" ? "string"
    : typeof node === "boolean" ? "bool" : typeof node === "number" ? "number" : "other";
  return new Set([`${path}:${kind}`]);
}
// rb:end
