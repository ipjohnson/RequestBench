// RequestBench open-loop blend driver.
//
// Latency is measured from each request's SCHEDULED time, not from when it was actually
// written to the socket. That is the coordinated-omission correction: if the generator or
// the target falls behind, the backlog shows up as latency instead of quietly vanishing.
//
//   node gen/blend.mjs --target 127.0.0.1:8080 --rate 3000 --seconds 60 --workers 4
//
// --slices also records the run as a ramp: one histogram per slice of the schedule, every
// endpoint merged, each slice ending at the edge given in seconds. --first sends one request
// on its own before anything else and times it apart from the ramp.
//
//   node gen/blend.mjs --target 127.0.0.1:8080 --rate 1000 --seconds 30 --record false \
//     --slices 1,2,3,4,5,6,7,8,9,10,20,30 --first json.small
//
// --values is the run's values as one JSON object, the way harness/run.py passes them.
// Without it the generator draws its own.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import http from "node:http";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// ---- histogram: log-linear buckets, ~2% relative error, microsecond input -----------
const GROWTH = 1.02;
const LOG_G = Math.log(GROWTH);
const NBUCKETS = 920;
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

// ---- plan ---------------------------------------------------------------------------
function loadPlan(only) {
  const plan = JSON.parse(readFileSync(join(ROOT, "spec", "plan.json"), "utf8"));
  if (plan.sampling !== "uniform") throw new Error(`plan sampling is ${plan.sampling}`);
  // Uniform, so there is no cumulative table and no weighted pick. Weighting happens once,
  // in harness/summarize.py, against the per-endpoint histograms this run produces.
  let eps = plan.endpoints;
  if (only && only.length) {
    // Narrowing here rather than dropping rows afterwards is the whole point: a runtime
    // optimises for the paths it executes, so a handful of endpoints running alone are
    // hotter than the same ones inside the full set. Dropping rows later would report the
    // full set's numbers under a smaller heading.
    const want = new Set(only);
    const missing = only.filter((id) => !plan.endpoints.some((e) => e.id === id));
    if (missing.length) throw new Error(`unknown endpoint id: ${missing.join(", ")}`);
    eps = eps.filter((e) => want.has(e.id));
  }
  return { eps, captures: plan.captures ?? {}, runValues: plan.run_values ?? {} };
}

// ---- values drawn once per run --------------------------------------------------------
// A value a handler binds and echoes is drawn once per run, so that no target can know it in
// advance. harness/run.py passes the ones it drew, so the load carries what the gate checked.
// Filled in before any worker starts sending, the way a capture is, which keeps the string
// formatting out of the hot loop.
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
function withValues(eps, values) {
  const url = (s) => s.replace(RUN, (_, name) => encodeURIComponent(String(values[name])));
  const raw = (h) => h && Object.fromEntries(Object.entries(h).map(([k, v]) =>
    [k, v.replace(RUN, (_, name) => String(values[name]))]));
  return eps.map((ep) => ({ ...ep, paths: ep.paths.map(url), headers: raw(ep.headers),
                            header_variants: ep.header_variants?.map(raw) }));
}

// ---- the two-phase capture ----------------------------------------------------------
// One header value in the plan is a {capture.<name>} placeholder rather than a literal,
// because it is whatever this target's own ETag machinery computed and no committed file
// can hold it. Resolved once here, before any worker starts, and passed down as a plain
// value: the tag is constant for as long as the body is, so reading it per request would
// measure the extra request.
const PLACEHOLDER = /\{capture\.([a-z_]+)\}/g;

const referenced = (eps) => new Set(eps.flatMap((ep) =>
  [...(ep.header_variants ?? [ep.headers ?? {}])].flatMap((h) =>
    Object.values(h).flatMap((v) => [...v.matchAll(PLACEHOLDER)].map((m) => m[1])))));

function ask(host, port, method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path, method }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.headers));
    });
    req.on("error", reject);
    req.end();
  });
}

async function resolveCaptures(host, port, captures, eps) {
  const want = referenced(eps);
  const out = {};
  for (const [name, cap] of Object.entries(captures)) {
    if (!want.has(name)) continue;
    const headers = await ask(host, port, cap.method, cap.path);
    const value = headers[cap.header.toLowerCase()];
    if (value === undefined) {
      throw new Error(`capture ${name}: ${cap.method} ${cap.path} answered no ${cap.header} `
        + "header, so the conditional arm cannot be sent");
    }
    out[name] = value;
  }
  return out;
}

// ---- the first request --------------------------------------------------------------
// Sent alone, before the captures are read and before any worker starts, so it is the first
// request the target serves after the readiness probe. On a cold runtime it pays for class
// loading, static init and the first compile of its path. Inside a slice it would be one
// sample among a thousand. A row whose headers need a capture cannot go first, so when the
// named row is not live or needs one, the first live row that needs none goes instead.
function firstOf(eps, id) {
  const plain = eps.filter((ep) => referenced([ep]).size === 0);
  return plain.find((ep) => ep.id === id) ?? plain[0];
}

function sendFirst(host, port, ep) {
  const path = ep.paths[0];
  const headers = headerSets(ep, {})[0];
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const us = () => Math.round(Number(process.hrtime.bigint() - t0) / 1000);
    // A connection of its own, the way a first request to a new instance arrives.
    const opts = { host, port, path, method: ep.method, headers, agent: false };
    const req = http.request(opts, (res) => {
      res.resume();
      res.on("end", () => resolve({ endpoint: ep.id, path, status: res.statusCode, us: us() }));
    });
    req.setTimeout(30_000, () => req.destroy(new Error("no answer in 30s")));
    req.on("error", (e) => resolve({ endpoint: ep.id, path, error: e.code ?? e.message, us: us() }));
    req.end(ep.body);
  });
}

/** The plan's header sets with every capture filled in, one per vary combination. */
function headerSets(ep, captured) {
  // Only the plan's own values are filled: content-length below is a number, and the body
  // headers carry no placeholder to fill in anyway.
  const fill = (h) => Object.fromEntries(Object.entries(h).map(([k, v]) =>
    [k, v.replace(PLACEHOLDER, (_, name) => captured[name])]));
  const body = ep.body
    ? { "content-type": "application/json", "content-length": Buffer.byteLength(ep.body) }
    : {};
  const variants = ep.header_variants ?? [{}];
  return variants.map((v) => {
    const h = { ...fill({ ...(ep.headers ?? {}), ...v }), ...body };
    return Object.keys(h).length ? h : undefined;
  });
}

// ---- worker -------------------------------------------------------------------------
if (!isMainThread) {
  const { host, port, rate, seconds, offsetUs, maxInflight, seed, record, only,
          captured, edges, values } = workerData;
  const eps = withValues(loadPlan(only).eps, values);
  // Header objects are built once per endpoint rather than per request, because this is the
  // hot loop. A vary row has one per combination instead of one for the endpoint, which is
  // still a lookup rather than an allocation: the instance drawn picks the combination, so
  // a response cache sees each of them and has a key to hold for each.
  const headersOf = eps.map((ep) => headerSets(ep, captured));

  const agent = new http.Agent({ keepAlive: true, maxSockets: maxInflight,
                                 maxFreeSockets: maxInflight, scheduling: "fifo",
                                 noDelay: true });
  const hist = eps.map(() => new Uint32Array(NBUCKETS));
  const counts = new Uint32Array(eps.length);
  const errors = new Uint32Array(eps.length);
  const mismatch = new Uint32Array(eps.length);
  // The statuses an endpoint may answer with. Usually one. A body that will not
  // parse is a 400 by RFC and a 422 by the contract the validator answers with, and
  // the endpoint set accepts either.
  const accepted = eps.map((ep) => new Set(ep.accepts ?? [ep.expect]));
  let dropped = 0, inflight = 0, issued = 0, done = 0;

  // xorshift so each worker walks the instance list differently but reproducibly
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };

  const periodUs = 1e6 / rate;
  const totalReq = Math.round(rate * seconds);
  const startNs = process.hrtime.bigint() + BigInt(Math.round(offsetUs * 1000));

  // A request belongs to the slice its scheduled moment falls in, not the one it completed
  // in, so a backlog shows up as latency in the second that caused it.
  const nslices = edges ? edges.length : 0;
  const sliceHist = Array.from({ length: nslices }, () => new Uint32Array(NBUCKETS));
  const sliceErrors = new Uint32Array(nslices);
  const sliceMismatch = new Uint32Array(nslices);
  const sliceDropped = new Uint32Array(nslices);
  let slice = 0;
  // `issued` only grows, so the slice only moves forward. Anything scheduled past the last
  // edge is folded into the last slice rather than lost.
  function sliceOf(i) {
    if (!nslices) return -1;
    const at = (offsetUs + i * periodUs) / 1e6;
    while (slice < nslices - 1 && at >= edges[slice]) slice++;
    return slice;
  }

  function fire(idx, scheduledNs, sl) {
    const ep = eps[idx];
    const instance = (rnd() * ep.paths.length) | 0;
    const sets = headersOf[idx];
    const opts = { host, port, path: ep.paths[instance], method: ep.method, agent,
                   headers: sets[instance % sets.length] };
    inflight++;
    const req = http.request(opts, (res) => {
      if (!accepted[idx].has(res.statusCode)) {
        mismatch[idx]++;
        if (sl >= 0) sliceMismatch[sl]++;
      }
      res.resume();
      res.on("end", () => {
        inflight--; done++;
        if (record || sl >= 0) {
          const b = bucketOf(Number(process.hrtime.bigint() - scheduledNs) / 1000);
          if (record) { hist[idx][b]++; counts[idx]++; }
          if (sl >= 0) sliceHist[sl][b]++;
        }
      });
    });
    req.on("error", () => {
      inflight--; done++; errors[idx]++;
      if (sl >= 0) sliceErrors[sl]++;
    });
    req.end(ep.body);   // one write, not two, so there is nothing for Nagle to hold
  }

  function tick() {
    const nowNs = process.hrtime.bigint();
    // Fire every request whose scheduled moment has already passed.
    while (issued < totalReq) {
      const dueNs = startNs + BigInt(Math.round(issued * periodUs * 1000));
      if (dueNs > nowNs) break;
      const sl = sliceOf(issued);
      if (inflight >= maxInflight) {
        dropped++; issued++;
        if (sl >= 0) sliceDropped[sl]++;
        continue;
      }
      fire((rnd() * eps.length) | 0, dueNs, sl);
      issued++;
    }
    if (issued < totalReq) {
      // setTimeout's floor is ~1ms, which lands directly in the latency we are trying to
      // measure. setImmediate re-enters on the next event-loop turn (tens of microseconds)
      // and still drains pending response callbacks, so scheduling precision costs us
      // loop spin rather than measurement error. Only sleep when the next request is far off.
      const gapUs = Number(startNs + BigInt(Math.round(issued * periodUs * 1000))
                           - process.hrtime.bigint()) / 1000;
      return gapUs > 4000 ? setTimeout(tick, Math.floor(gapUs / 1000) - 1) : setImmediate(tick);
    }
    const settle = setInterval(() => {
      if (inflight === 0) { clearInterval(settle); report(); }
    }, 5);
    setTimeout(() => { clearInterval(settle); report(); }, 10_000).unref();
  }

  let reported = false;
  function report() {
    if (reported) return; reported = true;
    agent.destroy();
    parentPort.postMessage({
      hist: hist.map((h) => Buffer.from(h.buffer, h.byteOffset, h.byteLength)),
      counts: Buffer.from(counts.buffer), errors: Buffer.from(errors.buffer),
      mismatch: Buffer.from(mismatch.buffer), dropped, issued, done,
      sliceHist: sliceHist.map((h) => Buffer.from(h.buffer, h.byteOffset, h.byteLength)),
      sliceErrors: Buffer.from(sliceErrors.buffer), sliceMismatch: Buffer.from(sliceMismatch.buffer),
      sliceDropped: Buffer.from(sliceDropped.buffer),
    });
  }
  tick();
}

// ---- main ---------------------------------------------------------------------------
else {
  const argv = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, a) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), a[i + 1]]); return acc;
  }, []));
  const [host, port] = (argv.target ?? "127.0.0.1:8080").split(":");
  const rate = Number(argv.rate ?? 1000);
  const seconds = Number(argv.seconds ?? 10);
  const workers = Number(argv.workers ?? 4);
  const maxInflight = Number(argv.maxInflight ?? 256);
  // Whether the per-endpoint histograms are kept. --slices keeps its own either way.
  const record = argv.record !== "false";
  const only = argv.only ? argv.only.split(",").filter(Boolean) : null;
  const edges = argv.slices ? argv.slices.split(",").map(Number) : null;
  if (edges && (edges.some((e, i) => !(e > (i ? edges[i - 1] : 0))) || edges.at(-1) !== seconds)) {
    throw new Error(`--slices ${argv.slices} has to rise from above 0 to --seconds ${seconds}`);
  }
  const { eps: planned, captures, runValues } = loadPlan(only);
  const values = argv.values ? JSON.parse(argv.values) : draw(runValues);
  const eps = withValues(planned, values);
  const firstEp = argv.first ? firstOf(eps, argv.first) : undefined;
  const first = firstEp ? await sendFirst(host, Number(port), firstEp) : null;
  // Before anything is offered, and in this thread: four workers each asking the target for
  // the same tag would be four requests for one answer, and they could disagree.
  const captured = await resolveCaptures(host, Number(port), captures, eps);

  const perWorker = rate / workers;
  const results = [];
  const t0 = Date.now();

  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { host, port: Number(port), rate: perWorker, seconds,
                    offsetUs: (w * 1e6) / rate, maxInflight: Math.ceil(maxInflight / workers),
                    seed: 0x9e3779b9 * (w + 1), record, only, captured, edges, values },
    });
    worker.on("message", (m) => { results.push(m); resolve(); });
    worker.on("error", reject);
  })));
  const elapsed = (Date.now() - t0) / 1000;

  const merged = eps.map(() => new Uint32Array(NBUCKETS));
  const counts = new Uint32Array(eps.length);
  const errors = new Uint32Array(eps.length);
  const mismatch = new Uint32Array(eps.length);
  let dropped = 0, issued = 0, done = 0;
  for (const r of results) {
    r.hist.forEach((buf, i) => {
      const h = new Uint32Array(buf.buffer, buf.byteOffset, NBUCKETS);
      for (let b = 0; b < NBUCKETS; b++) merged[i][b] += h[b];
    });
    const c = new Uint32Array(r.counts.buffer, r.counts.byteOffset, eps.length);
    const e = new Uint32Array(r.errors.buffer, r.errors.byteOffset, eps.length);
    const m = new Uint32Array(r.mismatch.buffer, r.mismatch.byteOffset, eps.length);
    for (let i = 0; i < eps.length; i++) { counts[i] += c[i]; errors[i] += e[i]; mismatch[i] += m[i]; }
    dropped += r.dropped; issued += r.issued; done += r.done;
  }

  const nslices = edges ? edges.length : 0;
  const sliceHist = Array.from({ length: nslices }, () => new Uint32Array(NBUCKETS));
  const sliceErrors = new Uint32Array(nslices);
  const sliceMismatch = new Uint32Array(nslices);
  const sliceDropped = new Uint32Array(nslices);
  for (const r of results) {
    r.sliceHist.forEach((buf, i) => {
      const h = new Uint32Array(buf.buffer, buf.byteOffset, NBUCKETS);
      for (let b = 0; b < NBUCKETS; b++) sliceHist[i][b] += h[b];
    });
    const e = new Uint32Array(r.sliceErrors.buffer, r.sliceErrors.byteOffset, nslices);
    const m = new Uint32Array(r.sliceMismatch.buffer, r.sliceMismatch.byteOffset, nslices);
    const d = new Uint32Array(r.sliceDropped.buffer, r.sliceDropped.byteOffset, nslices);
    for (let i = 0; i < nslices; i++) { sliceErrors[i] += e[i]; sliceMismatch[i] += m[i]; sliceDropped[i] += d[i]; }
  }
  // The whole distribution per slice, gzipped. Most of the 920 buckets are empty, so a
  // one-second slice is a few hundred bytes, and the shape in the first second against
  // the last is what a ramp is for.
  const slices = sliceHist.map((h, i) => {
    const count = h.reduce((s, c) => s + c, 0);
    return {
      start_s: i ? edges[i - 1] : 0, seconds: edges[i] - (i ? edges[i - 1] : 0), count,
      errors: sliceErrors[i], mismatch: sliceMismatch[i], dropped: sliceDropped[i],
      p50_us: percentile(h, count, 50), p99_us: percentile(h, count, 99),
      hist_gz: gzipSync(Buffer.from(h.buffer), { level: 9 }).toString("base64"),
    };
  });

  const all = new Uint32Array(NBUCKETS);
  for (const h of merged) for (let b = 0; b < NBUCKETS; b++) all[b] += h[b];
  const totalRec = counts.reduce((s, c) => s + c, 0);

  const out = {
    target: `${host}:${port}`, offered_rps: rate, seconds, workers,
    endpoints_live: eps.length,
    elapsed_s: Number(elapsed.toFixed(2)),
    achieved_rps: Math.round(done / elapsed),
    issued, completed: done, dropped,
    errors: errors.reduce((s, e) => s + e, 0),
    status_mismatch: mismatch.reduce((s, m) => s + m, 0),
    overall: { count: totalRec, p50_us: percentile(all, totalRec, 50),
               p90_us: percentile(all, totalRec, 90), p99_us: percentile(all, totalRec, 99),
               p999_us: percentile(all, totalRec, 99.9) },
    endpoints: eps.map((ep, i) => ({
      id: ep.id, family: ep.family, count: counts[i], errors: errors[i], mismatch: mismatch[i],
      p50_us: percentile(merged[i], counts[i], 50), p99_us: percentile(merged[i], counts[i], 99),
      hist_b64: Buffer.from(merged[i].buffer).toString("base64"),
    })),
    ...(argv.first ? { first } : {}),
    ...(edges ? { slices } : {}),
  };
  if (argv.out) { const { writeFileSync } = await import("node:fs"); writeFileSync(argv.out, JSON.stringify(out)); }
  // stdout stays human-sized; histograms travel via --out.
  console.log(JSON.stringify({
    ...out, endpoints: out.endpoints.map(({ hist_b64, ...e }) => e),
    ...(edges ? { slices: slices.map(({ hist_gz, ...s }) => s) } : {}),
  }, null, 1));
}
