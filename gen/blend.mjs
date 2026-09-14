// RequestBench open-loop blend driver.
//
// Latency is measured from each request's SCHEDULED time, not from when it was actually
// written to the socket. That is the coordinated-omission correction: if the generator or
// the target falls behind, the backlog shows up as latency instead of quietly vanishing.
//
//   node gen/blend.mjs --target 127.0.0.1:8080 --rate 3000 --seconds 60 --workers 4
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
function loadPlan() {
  const plan = JSON.parse(readFileSync(join(ROOT, "spec", "plan.json"), "utf8"));
  const eps = plan.endpoints;
  const total = eps.reduce((s, e) => s + e.share, 0);
  // Cumulative share table for O(log n) weighted pick.
  const cum = new Float64Array(eps.length);
  let acc = 0;
  eps.forEach((e, i) => { acc += e.share / total; cum[i] = acc; });
  cum[eps.length - 1] = 1;
  return { eps, cum };
}
function pick(cum, r) {
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (r <= cum[mid]) hi = mid; else lo = mid + 1; }
  return lo;
}

// ---- worker -------------------------------------------------------------------------
if (!isMainThread) {
  const { host, port, rate, seconds, offsetUs, maxInflight, seed, record } = workerData;
  const { eps, cum } = loadPlan();

  const agent = new http.Agent({ keepAlive: true, maxSockets: maxInflight,
                                 maxFreeSockets: maxInflight, scheduling: "fifo",
                                 noDelay: true });
  const hist = eps.map(() => new Uint32Array(NBUCKETS));
  const counts = new Uint32Array(eps.length);
  const errors = new Uint32Array(eps.length);
  const mismatch = new Uint32Array(eps.length);
  let dropped = 0, inflight = 0, issued = 0, done = 0;

  // xorshift so each worker walks the instance list differently but reproducibly
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };

  const periodUs = 1e6 / rate;
  const totalReq = Math.round(rate * seconds);
  const startNs = process.hrtime.bigint() + BigInt(Math.round(offsetUs * 1000));

  function fire(idx, scheduledNs) {
    const ep = eps[idx];
    const path = ep.paths[(rnd() * ep.paths.length) | 0];
    const opts = { host, port, path, method: ep.method, agent,
                   headers: ep.body
                     ? { "content-type": "application/json", "content-length": Buffer.byteLength(ep.body) }
                     : undefined };
    inflight++;
    const req = http.request(opts, (res) => {
      if (res.statusCode !== ep.expect) mismatch[idx]++;
      res.resume();
      res.on("end", () => {
        inflight--; done++;
        if (record) {
          const us = Number(process.hrtime.bigint() - scheduledNs) / 1000;
          hist[idx][bucketOf(us)]++;
          counts[idx]++;
        }
      });
    });
    req.on("error", () => { inflight--; done++; errors[idx]++; });
    req.end(ep.body);   // one write, not two, so there is nothing for Nagle to hold
  }

  function tick() {
    const nowNs = process.hrtime.bigint();
    // Fire every request whose scheduled moment has already passed.
    while (issued < totalReq) {
      const dueNs = startNs + BigInt(Math.round(issued * periodUs * 1000));
      if (dueNs > nowNs) break;
      if (inflight >= maxInflight) { dropped++; issued++; continue; }
      fire(pick(cum, rnd()), dueNs);
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
  const record = argv.record !== "false";
  const { eps } = loadPlan();

  const perWorker = rate / workers;
  const results = [];
  const t0 = Date.now();

  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { host, port: Number(port), rate: perWorker, seconds,
                    offsetUs: (w * 1e6) / rate, maxInflight: Math.ceil(maxInflight / workers),
                    seed: 0x9e3779b9 * (w + 1), record },
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

  const all = new Uint32Array(NBUCKETS);
  for (const h of merged) for (let b = 0; b < NBUCKETS; b++) all[b] += h[b];
  const totalRec = counts.reduce((s, c) => s + c, 0);

  const out = {
    target: `${host}:${port}`, offered_rps: rate, seconds, workers,
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
  };
  if (argv.out) { const { writeFileSync } = await import("node:fs"); writeFileSync(argv.out, JSON.stringify(out)); }
  // stdout stays human-sized; histograms travel via --out.
  console.log(JSON.stringify({ ...out, endpoints: out.endpoints.map(({ hist_b64, ...e }) => e) }, null, 1));
}
