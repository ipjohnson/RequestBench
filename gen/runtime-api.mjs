// The Lambda Runtime API, served by the harness in place of the Runtime Interface Emulator.
//
// A Lambda base image starts RIE only when AWS_LAMBDA_RUNTIME_API is unset. Pointed here
// instead, the image's entrypoint runs the function's own runtime, which polls this server
// for work: GET .../invocation/next hands it an event and POST .../invocation/{id}/response
// brings the answer back. The time between the two is what Lambda reports as Duration. It
// is taken here, beside the runtime on loopback, and returned with the answer as
// x-rb-duration-ns. Timed by the caller through RIE instead, a small request spent more
// time in RIE's HTTP front end than in the framework.
//
// Callers invoke the function the way they invoked RIE, by POSTing an event to
// /2015-03-31/functions/function/invocations. One execution environment runs one invocation
// at a time, so events are handed over one at a time in the order they arrived.
//
//   node gen/runtime-api.mjs --invoke 8080 --api 9001
import http from "node:http";
import { randomUUID } from "node:crypto";

const argv = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, all) => {
  if (c.startsWith("--")) a.push([c.slice(2), all[i + 1]]); return a;
}, []));
const INVOKE_PORT = Number(argv.invoke ?? 8080);
const API_PORT = Number(argv.api ?? 9001);

// The function's timeout, which the runtime is told as its deadline. A runtime that died
// mid-invocation never answers and never polls again. RIE was the runtime's parent and
// restarted it, but a runtime in another container cannot be restarted from here. So once
// the runtime has polled, an event it leaves unanswered or unclaimed this long ends the
// environment, and every event after that gets an error at once instead of hanging the
// gate or the driver.
const TIMEOUT_MS = 30_000;
const ARN = "arn:aws:lambda:us-east-1:000000000000:function:rb";
const TRACE = "Root=1-00000000-000000000000000000000000;Parent=0000000000000000;Sampled=0";
const INVOKE = /^\/2015-03-31\/functions\/[^/]+\/invocations$/;
const ANSWER = /^\/2018-06-01\/runtime\/invocation\/([^/]+)\/(response|error)$/;

const waiting = [];         // events not yet handed to the runtime
const polls = [];           // GET /next requests the runtime is holding open
const running = new Map();  // events the runtime has taken, by request id
let polled = false;         // whether the runtime has finished starting and asked for work
let over;                   // the answer every event gets once the environment has ended

function read(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function reply(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json",
                          "content-length": payload.length, ...headers });
  res.end(payload);
}

const json = (value) => Buffer.from(JSON.stringify(value));

function dispatch() {
  while (waiting.length && polls.length) {
    const inv = waiting.shift();
    if (inv.gone) continue;
    const poll = polls.shift();
    running.set(inv.id, inv);
    poll.writeHead(200, {
      "content-type": "application/json",
      "content-length": inv.event.length,
      "lambda-runtime-aws-request-id": inv.id,
      "lambda-runtime-deadline-ms": String(Date.now() + TIMEOUT_MS),
      "lambda-runtime-invoked-function-arn": ARN,
      "lambda-runtime-trace-id": TRACE,
    });
    inv.handed = process.hrtime.bigint();
    poll.end(inv.event);
  }
}

// Called once the runtime's whole answer has been read, which is where Duration stops.
function answer(inv, payload, headers) {
  const ns = process.hrtime.bigint() - inv.handed;
  running.delete(inv.id);
  if (!inv.gone) reply(inv.res, 200, payload, { "x-rb-duration-ns": String(ns), ...headers });
}

function end(payload, why) {
  over = payload;
  process.stderr.write(`${why}\n`);
  for (const inv of [...running.values(), ...waiting.splice(0)]) {
    if (!inv.gone) reply(inv.res, 200, payload, { "x-amz-function-error": "Unhandled" });
  }
  running.clear();
}

setInterval(() => {
  if (over || !polled) return;
  const limit = BigInt(TIMEOUT_MS) * 1_000_000n, now = process.hrtime.bigint();
  const late = [...running.values()].some((inv) => now - inv.handed > limit);
  const stuck = !running.size && waiting.some((inv) => !inv.gone && now - inv.queued > limit);
  if (late || stuck) {
    const why = late ? `the runtime did not answer within ${TIMEOUT_MS} ms`
                     : `the runtime stopped asking for work for ${TIMEOUT_MS} ms`;
    end(json({ errorType: "Runtime.Unavailable", errorMessage: why }), why);
  }
}, 1000).unref();

const api = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/2018-06-01/runtime/invocation/next") {
    polled = true;
    polls.push(res);
    // A runtime that dies while polling leaves its request behind, and the next event
    // must not be written into it.
    res.on("close", () => {
      const i = polls.indexOf(res);
      if (i !== -1) polls.splice(i, 1);
    });
    dispatch();
    return;
  }
  const m = ANSWER.exec(req.url);
  if (req.method === "POST" && m) {
    const payload = await read(req);
    const inv = running.get(m[1]);
    if (!inv) {
      reply(res, 400, json({ errorMessage: `unknown request id ${m[1]}`,
                             errorType: "InvalidRequestID" }));
      return;
    }
    // RIE answers a function error with a 200 and the error as the body, and the callers
    // read it that way.
    const kind = req.headers["lambda-runtime-function-error-type"] ?? "Unhandled";
    answer(inv, payload, m[2] === "error" ? { "x-amz-function-error": kind } : {});
    reply(res, 202, json({ status: "OK" }));
    return;
  }
  if (req.method === "POST" && req.url === "/2018-06-01/runtime/init/error") {
    const payload = await read(req);
    end(payload, `init error: ${payload}`);
    reply(res, 202, json({ status: "OK" }));
    return;
  }
  reply(res, 404, json({ errorMessage: `no route for ${req.method} ${req.url}` }));
});

const front = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/ready") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST" || !INVOKE.test(req.url)) {
    reply(res, 404, json({ errorMessage: `no route for ${req.method} ${req.url}` }));
    return;
  }
  const event = await read(req);
  if (over) {
    reply(res, 200, over, { "x-amz-function-error": "Unhandled" });
    return;
  }
  const inv = { id: randomUUID(), event, res, handed: 0n,
                queued: process.hrtime.bigint(), gone: false };
  // A caller can give up before the runtime takes its event. Handed over later, that
  // event would run ahead of the caller's next one.
  res.on("close", () => { if (!res.writableEnded) inv.gone = true; });
  waiting.push(inv);
  dispatch();
});

// The runtime side first, so /ready answering means both are up.
api.listen(API_PORT, "127.0.0.1", () => front.listen(INVOKE_PORT, "0.0.0.0"));
