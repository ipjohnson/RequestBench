import { promisify } from "node:util";
import { constants, gzip } from "node:zlib";

import { HTTPResponse, onResponse } from "h3";

import type { Routes } from "../app.ts";
import { fresh } from "../serial.ts";

const deflate = promisify(gzip);

// rb:wiring compressed.*
/**
 * h3 ships no compression, so this is middleware written for the two routes. onResponse hands it
 * the Response h3 made from the handler's answer. A body under 1 KB, the threshold the Node
 * compressors default to, goes out as it is. A larger one says it varies on Accept-Encoding, and goes
 * out gzipped at zlib's fastest level when the request accepts gzip.
 */
const THRESHOLD = 1024;

const gzipped = onResponse(async (response, event) => {
  const body = Buffer.from(await response.arrayBuffer());
  const headers = new Headers(response.headers);
  if (body.length < THRESHOLD) return new HTTPResponse(body, { status: response.status, headers });
  headers.append("vary", "accept-encoding");
  if (!/\bgzip\b/.test(event.req.headers.get("accept-encoding") ?? "")) return new HTTPResponse(body, { status: response.status, headers });
  headers.set("content-encoding", "gzip");
  return new HTTPResponse(await deflate(body, { level: constants.Z_BEST_SPEED }), { status: response.status, headers });
});
// rb:end

/** compressed: these routes answer like any other, and the middleware gzips the answer when the request asks for it. */
const compressed: Routes = (app, p) => {
  app.get("/compressed/small", (event) => fresh(event, p.small), { middleware: [gzipped] });

  app.get("/compressed/large", (event) => fresh(event, p.large), { middleware: [gzipped] });
};

export default compressed;
