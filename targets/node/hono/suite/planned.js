// rb:test *
/**
 * What a correct answer is, and which request asks for it.
 *
 * Both come out of spec/. spec/expected.json is the only authority on a correct answer and
 * the conformance client is the only thing that judges a target against it, so a suite that
 * passes while `make test` fails this target is the suite that is wrong, and writing a status
 * or a body into a test as a literal is how the two drift apart. spec/plan.json is where an
 * order id, a query string and a request body come from.
 *
 * Instance zero, always. An endpoint sends up to 512 requests and the conformance client
 * replays every one; a suite sends one, so it has to be the same one on every run or a
 * failure would not reproduce.
 *
 * A {run.<name>} placeholder is the exception. It stands for a value no target may know in
 * advance, so this draws its own each time it is loaded.
 */
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The test runs from somewhere under the repository, and the root is where spec/ is.
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "spec", "expected.json"))) root = dirname(root);

const read = (name) => JSON.parse(readFileSync(join(root, "spec", name), "utf8"));
const plan = read("plan.json");
const expected = read("expected.json");
const values = draw(plan.run_values ?? {});

/** One of an endpoint's requests, and the answer pinned for it. */
export function ask(id) {
  const ep = plan.endpoints.find((e) => e.id === id);
  const path = ep.paths[0];
  // A vary row sends a different header set per instance, which is what the response cache
  // is keyed on. Instance zero, for the reason above.
  const headers = { ...(ep.headers ?? {}), ...(ep.header_variants?.[0] ?? {}) };
  for (const [k, v] of Object.entries(headers)) headers[k] = inHeader(v);
  if (ep.body != null) headers["content-type"] = "application/json";
  // Keyed by the path as the plan writes it, with any {run.<name>} still in it, because the
  // path that is sent changes every run.
  const key = `${id} ${path}`;
  // null for an error endpoint: its envelope is the framework's own contract, and
  // envelope.js rather than floor.js is what judges it.
  const pinned = id in expected.errors ? null : expected.requests[key];
  const want = pinned && { ...pinned, body: filled(pinned.body) };
  return { id, key, method: ep.method, path: inPath(path), headers, body: ep.body ?? null, want };
}

const RUN = /\{run\.([a-z_]+)\}/g;
const WHOLE = /^\{run\.([a-z_]+)\}$/;

/** One value per declaration: an int as a number, anything else as a string. */
function draw(declared) {
  const text = (length, chars) =>
    Array.from({ length }, () => chars.charAt(randomInt(chars.length))).join("");
  const out = {};
  for (const [name, rule] of Object.entries(declared)) {
    if (rule.kind === "int") out[name] = randomInt(10 ** (rule.digits - 1), 10 ** rule.digits);
    else if (rule.kind === "string") out[name] = text(rule.length, rule.chars);
    else if (rule.kind === "words") {
      out[name] = Array.from({ length: rule.count }, () => text(rule.length, rule.chars)).join(" ");
    } else out[name] = rule.values[randomInt(rule.values.length)];
  }
  return out;
}

/**
 * A path with every value in it, percent-encoded. A space goes as %20 and never as +,
 * because RFC 3986 does not read + as a space.
 */
const inPath = (path) => path.replace(RUN, (_, name) => encodeURIComponent(String(values[name])));

/** A header value with every value in it, as it is. */
const inHeader = (value) => value.replace(RUN, (_, name) => String(values[name]));

/**
 * The pinned body with every value in it. spec/expected.json holds each as its placeholder,
 * always a string, and an int goes back in as the number it is.
 */
function filled(body) {
  if (typeof body === "string") {
    const m = WHOLE.exec(body);
    return m ? values[m[1]] : body;
  }
  if (Array.isArray(body)) return body.map(filled);
  if (body !== null && typeof body === "object") {
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, filled(v)]));
  }
  return body;
}

/**
 * The request a validator is taken from, for the one endpoint that needs one first.
 * etag.match_large carries {capture.etag_large} in its if-none-match, which only the target
 * can produce, so nothing can send it until the target has answered a different request.
 */
export function captureFor(a) {
  for (const value of Object.values(a.headers)) {
    if (value.startsWith("{capture.")) return plan.captures[value.slice(9, -1)];
  }
  return null;
}

/** The same headers with the capture's placeholder replaced by what was captured. */
export const resolved = (a, captured) => Object.fromEntries(
  Object.entries(a.headers).map(([k, v]) => [k, v.startsWith("{capture.") ? captured : v]));

/** The error envelope this target recorded, as status, body class and shape. */
export const envelope = (target, key) => expected.targets[target]?.[key] ?? null;
// rb:end
