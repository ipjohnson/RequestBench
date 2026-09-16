// RequestBench serial driver, for hosts that process one invocation at a time.
//
// A Lambda execution environment has no concurrency of its own, so there is no knee to
// find and a rate ladder asks a question the model cannot answer. This replays a pinned
// sequence strictly one at a time and reports how long the identical work took.
//
// Every target replays the same order, so nothing about the mix varies between them.
//
//   node gen/serial.mjs --target 127.0.0.1:8080 --encoding lambda --count 20000
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
const eps = plan.endpoints;

const LAMBDA_PATH = "/2015-03-31/functions/function/invocations";
// noDelay matters more than it looks. Writing a body and then ending is two writes, which
// Nagle holds until the peer ACKs, and a delayed ACK can sit for ~10ms. That time lands
// between requests rather than inside one, so elapsed inflates while every percentile
// stays normal -- the exact shape of the bogus 61s and 1186s runs.
const agent = new http.Agent({ keepAlive: true, maxSockets: 1, noDelay: true });

// The endpoint's own headers plus whatever the body requires. Four families are defined by
// what the request carries rather than where it points, so dropping these would leave them
// measuring the wrong thing rather than failing.
function reqHeaders(ep) {
  const h = { ...(ep.headers ?? {}) };
  if (ep.body) {
    h["content-type"] = "application/json";
    h["content-length"] = Buffer.byteLength(ep.body);
  }
  return Object.keys(h).length ? h : undefined;
}

function build(i) {
  const ep = eps[epIdx[i % epIdx.length]];
  const path = ep.paths[inIdx[i % inIdx.length] % ep.paths.length];
  if (encoding === "http") {
    return {
      opts: { host, port, path, method: ep.method, agent,
              headers: reqHeaders(ep) },
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
    headers: { ...(ep.headers ?? {}), "content-type": "application/json", host: "rb.invalid" },
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
        let status = res.statusCode;
        if (unwrap) {
          try { status = JSON.parse(Buffer.concat(chunks).toString()).statusCode; }
          catch { status = 0; }
        }
        if (record) {
          hist[idx][bucketOf(us)]++;
          counts[idx]++;
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

const out = {
  suite: "serial-v1", sequence: seq.version, encoding,
  target: `${host}:${port}`, requested: count, completed: done,
  warmup, elapsed_s: Number(elapsed.toFixed(3)),
  achieved_rps: Math.round(done / elapsed),
  errors: errors.reduce((s, e) => s + e, 0), timeouts,
  status_mismatch: mismatch.reduce((s, m) => s + m, 0),
  overall: { count: done, p50_us: percentile(all, done, 50), p90_us: percentile(all, done, 90),
             p99_us: percentile(all, done, 99), p999_us: percentile(all, done, 99.9) },
  endpoints: eps.map((ep, i) => ({
    id: ep.id, family: ep.family, count: counts[i], errors: errors[i], mismatch: mismatch[i],
    p50_us: percentile(hist[i], counts[i], 50), p99_us: percentile(hist[i], counts[i], 99),
    hist_b64: Buffer.from(hist[i].buffer).toString("base64"),
  })),
};
if (argv.out) writeFileSync(argv.out, JSON.stringify(out));
console.log(JSON.stringify({ ...out, endpoints: out.endpoints.map(({ hist_b64, ...e }) => e) }, null, 1));
