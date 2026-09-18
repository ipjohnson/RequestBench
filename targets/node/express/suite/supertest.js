// rb:test *
/**
 * The target, driven by supertest, over a real socket.
 *
 * Express has no testing guide of its own, and supertest is what its ecosystem reaches for. It
 * is not in-process in the sense inject() and app.request() are: given an application that is
 * not already listening, supertest binds it to an ephemeral loopback port and sends the request
 * over HTTP. The suite is run by Mocha, because that is what supertest's own README writes its
 * examples for.
 *
 * supertest's client is superagent, which unzips a gzip body before anything can read it, so
 * the body here is the decoded one and floor.js checks the encoding on the header alone. The
 * compressed family's codec is the compression middleware on a router carrying those three
 * routes, which is inside the application and reached.
 */
import request from "supertest";

import { app } from "../app.js";
import { captureFor, resolved } from "./planned.js";

/**
 * Send one of an endpoint's planned requests.
 *
 * superagent sets Accept-Encoding: gzip, deflate on every request it makes and offers no way
 * to leave it off, so a request the plan sends with no Accept-Encoding would go out asking for
 * gzip. identity is the one value that asks for what an absent header gets from these servers,
 * and a header the plan does name replaces it.
 */
export async function send(a, headers = a.headers) {
  headers = { "accept-encoding": "identity", ...headers };
  let req = request(app)[a.method.toLowerCase()](a.path).set(headers);
  if (a.body != null) req = req.send(a.body);
  const r = await req.buffer(true).parse(bytes);
  return {
    status: r.status,
    contentType: r.headers["content-type"] ?? "",
    encoding: r.headers["content-encoding"] ?? "",
    body: r.body,
    headers: r.headers,
  };
}

/** Collect the body as bytes rather than letting superagent parse JSON out of it. */
function bytes(res, done) {
  const chunks = [];
  res.on("data", (c) => chunks.push(Buffer.from(c)));
  res.on("end", () => done(null, Buffer.concat(chunks)));
}

/** Ask for the validator first, then send the request that carries it. */
export async function sendAfterCapture(a) {
  const { method, path, header } = captureFor(a);
  const first = await request(app)[method.toLowerCase()](path).set("accept-encoding", "identity");
  return send(a, resolved(a, first.headers[header] ?? ""));
}
// rb:end
