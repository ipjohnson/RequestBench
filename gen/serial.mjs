// RequestBench serial driver, for hosts that process one invocation at a time.
//
// A Lambda execution environment has no concurrency of its own, so there is no knee to
// find and a rate ladder asks a question the model cannot answer. This replays a pinned
// sequence strictly one at a time and reports how long the identical work took.
//
// Every target replays the same order, so nothing about the mix varies between them.
//
// For a Lambda host the time recorded is Duration, which gen/runtime-api.mjs takes beside
// the runtime and returns with each answer. The round trip through the invoke endpoint is
// kept as well, and the difference between the two is the invoke path, not the framework.
//
//   node gen/serial.mjs --target 127.0.0.1:8080 --encoding lambda --count 20000
//
// --values is the run's values as one JSON object, the way harness/run.py passes them.
// Without it the driver draws its own.
import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import http from "node:http";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const GROWTH = 1.02, LOG_G = Math.log(GROWTH), NBUCKETS = 920;
const bucketOf = (us) => (us <= 1 ? 0 : Math.min(NBUCKETS - 1, (Math.log(us) / LOG_G) | 0));
const valueOf = (i) => Math.exp((i + 0.5) * LOG_G);
function percentile(counts, total, p) {
  if (!total) return 0;
  let want = Math.ceil((p / 100) * total), seen = 0;
  for (let i = 0; i < counts.length; i++) {
    seen += counts[i];
    if (seen >= want) return Math.round(valueOf(i));
  }
  return Math.round(valueOf(counts.length - 1));
}

const argv = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, all) => {
  if (c.startsWith("--")) a.push([c.slice(2), all[i + 1]]); return a;
}, []));
const [host, port] = (argv.target ?? "127.0.0.1:8080").split(":");
const encoding = argv.encoding ?? "http";        // http | lambda
const count = Number(argv.count ?? 20000);
const warmup = Number(argv.warmup ?? 500);

const plan = JSON.parse(readFileSync(join(ROOT, "spec", "plan.json"), "utf8"));
const seq = JSON.parse(readFileSync(join(ROOT, "spec", "sequence.json"), "utf8"));
const epIdx = new Uint16Array(Buffer.from(seq.endpoint_index, "base64").buffer.slice(0));
const inIdx = new Uint16Array(Buffer.from(seq.instance_index, "base64").buffer.slice(0));
const skipped = new Set(seq.skipped_families ?? []);

// ---- values drawn once per run --------------------------------------------------------
// A value a handler binds and echoes is drawn once per run, so that no target can know it in
// advance. harness/run.py passes the ones it drew; run on its own, this draws its own. Filled
// in once, here, rather than per request.
const RUN = /\{run\.([a-z_]+)\}/g;

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

/** The endpoints with this run's values in them: percent-encoded in a URL, as they are in a
 *  header. A space is %20 and never +, because RFC 3986 does not read + as a space. */
function withValues(endpoints, values) {
  const url = (s) => s.replace(RUN, (_, name) => encodeURIComponent(String(values[name])));
  const raw = (h) => h && Object.fromEntries(Object.entries(h).map(([k, v]) =>
    [k, v.replace(RUN, (_, name) => String(values[name]))]));
  return endpoints.map((ep) => ({ ...ep, paths: ep.paths.map(url), headers: raw(ep.headers),
                                  header_variants: ep.header_variants?.map(raw) }));
}

const values = argv.values ? JSON.parse(argv.values) : draw(plan.run_values ?? {});
const eps = withValues(plan.endpoints, values);

const LAMBDA_PATH = "/2015-03-31/functions/function/invocations";
// noDelay matters more than it looks. Writing a body and then ending is two writes, which
// Nagle holds until the peer ACKs, and a delayed ACK can sit for ~10ms. That time lands
// between requests rather than inside one, so elapsed inflates while every percentile
// stays normal -- the exact shape of the bogus 61s and 1186s runs.
const agent = new http.Agent({ keepAlive: true, maxSockets: 1, noDelay: true });

// ---- the two-phase capture ----------------------------------------------------------
// A matching If-None-Match is whatever this target's own ETag machinery computed, so the
// plan carries a {capture.<name>} placeholder where every other header carries a literal.
// Resolved once, before the warmup, and substituted into the header sets built below.
const PLACEHOLDER = /\{capture\.([a-z_]+)\}/g;

function send(opts, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}

async function resolveCaptures() {
  const out = {};
  for (const [name, cap] of Object.entries(plan.captures ?? {})) {
    let headers;
    if (encoding === "http") {
      ({ headers } = await send({ host, port, path: cap.path, method: cap.method, agent }));
    } else {
      // A Lambda host serves only the invocations endpoint, so the capture goes through the
      // same envelope every other request does and its headers come back inside the result.
      const event = asEvent(cap.method, cap.path, undefined);
      const r = await send({ host, port, path: LAMBDA_PATH, method: "POST", agent,
                             headers: { "content-type": "application/json",
                                        "content-length": Buffer.byteLength(event) } }, event);
      headers = {};
      for (const [k, v] of Object.entries(JSON.parse(r.body.toString()).headers ?? {})) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    const value = headers[cap.header.toLowerCase()];
    if (value === undefined) {
      throw new Error(`capture ${name}: ${cap.method} ${cap.path} answered no ${cap.header} `
        + "header, so the conditional arm cannot be sent");
    }
    out[name] = value;
  }
  return out;
}

function asEvent(method, path, body) {
  const qi = path.indexOf("?");
  const rawPath = qi === -1 ? path : path.slice(0, qi);
  const query = qi === -1 ? {}
    : Object.fromEntries(new URLSearchParams(path.slice(qi + 1)));
  return JSON.stringify({
    version: "2.0", rawPath, rawQueryString: qi === -1 ? "" : path.slice(qi + 1),
    queryStringParameters: query,
    headers: { "content-type": "application/json", host: "rb.invalid" },
    requestContext: { http: { method, path: rawPath } },
    body: body ?? undefined, isBase64Encoded: false,
  });
}

// The endpoint's own headers plus whatever the body requires, one set per vary combination.
// Five families are defined by what the request carries rather than where it points, so
// dropping these would leave them measuring the wrong thing rather than failing.
function headerSets(ep, captured) {
  // Only the plan's own values are filled. The body headers carry no placeholder.
  const fill = (h) => Object.fromEntries(Object.entries(h).map(([k, v]) =>
    [k, v.replace(PLACEHOLDER, (_, name) => captured[name])]));
  // content-length is a string because the Lambda encoding copies these headers into the
  // event, and aws-lambda-go refuses the whole event when a header value is a number.
  const body = ep.body
    ? { "content-type": "application/json",
        "content-length": String(Buffer.byteLength(ep.body)) }
    : {};
  return (ep.header_variants ?? [{}]).map((v) => {
    const h = { ...fill({ ...(ep.headers ?? {}), ...v }), ...body };
    return Object.keys(h).length ? h : undefined;
  });
}

const captured = await resolveCaptures();
const headersOf = eps.map((ep) => headerSets(ep, captured));

function build(i) {
  const idx = epIdx[i % epIdx.length];
  const ep = eps[idx];
  const instance = inIdx[i % inIdx.length] % ep.paths.length;
  const path = ep.paths[instance];
  const sets = headersOf[idx];
  const headers = sets[instance % sets.length];
  if (encoding === "http") {
    return {
      opts: { host, port, path, method: ep.method, agent, headers },
      payload: ep.body, ep, unwrap: false,
    };
  }
  const qi = path.indexOf("?");
  const rawPath = qi === -1 ? path : path.slice(0, qi);
  const query = qi === -1 ? {}
    : Object.fromEntries(new URLSearchParams(path.slice(qi + 1)));
  const event = JSON.stringify({
    version: "2.0", rawPath, rawQueryString: qi === -1 ? "" : path.slice(qi + 1),
    queryStringParameters: query,
    headers: { ...headers, "content-type": "application/json", host: "rb.invalid" },
    requestContext: { http: { method: ep.method, path: rawPath } },
    body: ep.body ?? undefined, isBase64Encoded: false,
  });
  return {
    opts: { host, port, path: LAMBDA_PATH, method: "POST", agent,
            headers: { "content-type": "application/json",
                       "content-length": Buffer.byteLength(event) } },
    payload: event, ep, unwrap: true,
  };
}

let timeouts = 0;
const hist = eps.map(() => new Uint32Array(NBUCKETS));
const trip = new Uint32Array(NBUCKETS);
const billed = new Map();
const counts = new Uint32Array(eps.length);
const mismatch = new Uint32Array(eps.length);
// The statuses an endpoint may answer with. Usually one. A body that will not
// parse is a 400 by RFC and a 422 by the contract the validator answers with, and
// the endpoint set accepts either.
const accepted = eps.map((ep) => new Set(ep.accepts ?? [ep.expect]));
const errors = new Uint32Array(eps.length);

const TIMEOUT_MS = Number(argv.timeout ?? 10000);

function once(i, record) {
  const { opts, payload, ep, unwrap } = build(i);
  const idx = epIdx[i % epIdx.length];
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const req = http.request({ ...opts, timeout: TIMEOUT_MS }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const us = Number(process.hrtime.bigint() - t0) / 1000;
        let status = res.statusCode, duration;
        if (unwrap) {
          try { status = JSON.parse(Buffer.concat(chunks).toString()).statusCode; }
          catch { status = 0; }
          const ns = res.headers["x-rb-duration-ns"];
          if (ns === undefined && res.headers["x-amz-function-error"] !== undefined) {
            // The Runtime API has ended the environment, because its runtime died or
            // stopped asking for work. Nothing ran, so there is no Duration to record.
            if (record) errors[idx]++;
            resolve();
            return;
          }
          if (ns === undefined) {
            console.error("the invoke endpoint sent no x-rb-duration-ns, so it is not "
              + "gen/runtime-api.mjs and there is no Duration to record");
            process.exit(1);
          }
          duration = Number(ns) / 1000;
        }
        if (record) {
          hist[idx][bucketOf(unwrap ? duration : us)]++;
          counts[idx]++;
          if (unwrap) {
            trip[bucketOf(us)]++;
            const ms = Math.max(1, Math.ceil(duration / 1000));
            billed.set(ms, (billed.get(ms) ?? 0) + 1);
          }
          if (!accepted[idx].has(status)) mismatch[idx]++;
        }
        resolve();
      });
    });
    // Without this one stuck socket silently eats the run: elapsed balloons while every
    // recorded percentile stays normal, because a stall that never completes is never a sample.
    req.on("timeout", () => { timeouts++; req.destroy(); });
    req.on("error", () => { if (record) errors[idx]++; resolve(); });
    req.end(payload);   // one write, not two, so there is nothing for Nagle to hold
  });
}

// Strictly one in flight: await each before issuing the next.
for (let i = 0; i < warmup; i++) await once(i, false);
const t0 = Date.now();
for (let i = 0; i < count; i++) await once(warmup + i, true);
const elapsed = (Date.now() - t0) / 1000;

const all = new Uint32Array(NBUCKETS);
for (const h of hist) for (let b = 0; b < NBUCKETS; b++) all[b] += h[b];
const done = counts.reduce((s, c) => s + c, 0);
const lambda = encoding === "lambda";
const spread = (h) => ({ p50_us: percentile(h, done, 50), p90_us: percentile(h, done, 90),
                         p99_us: percentile(h, done, 99), p999_us: percentile(h, done, 99.9) });

const out = {
  suite: "serial-v1", sequence: seq.version, encoding,
  // What every percentile below times: Duration from the Runtime API for a Lambda host,
  // the round trip seen from here for any other.
  timing: lambda ? "runtime-api" : "client",
  target: `${host}:${port}`, requested: count, completed: done,
  warmup, elapsed_s: Number(elapsed.toFixed(3)),
  achieved_rps: Math.round(done / elapsed),
  errors: errors.reduce((s, e) => s + e, 0), timeouts,
  status_mismatch: mismatch.reduce((s, m) => s + m, 0),
  overall: { count: done, ...spread(all) },
  // Lambda bills Duration rounded up to the millisecond.
  ...(lambda ? {
    round_trip: spread(trip),
    billed_ms: Object.fromEntries([...billed].sort((a, b) => a[0] - b[0])),
  } : {}),
  // A family the sequence never draws is left out, rather than reported as never answered.
  endpoints: eps.flatMap((ep, i) => (skipped.has(ep.family) ? [] : [{
    id: ep.id, family: ep.family, count: counts[i], errors: errors[i], mismatch: mismatch[i],
    p50_us: percentile(hist[i], counts[i], 50), p99_us: percentile(hist[i], counts[i], 99),
    hist_b64: Buffer.from(hist[i].buffer).toString("base64"),
  }])),
};
if (argv.out) writeFileSync(argv.out, JSON.stringify(out));
console.log(JSON.stringify({ ...out, endpoints: out.endpoints.map(({ hist_b64, ...e }) => e) }, null, 1));
