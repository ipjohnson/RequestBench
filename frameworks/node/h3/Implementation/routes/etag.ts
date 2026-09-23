import { createHash } from "node:crypto";

import { handleCacheHeaders, type H3Event } from "h3";

import type { Routes } from "../app.ts";
import type { Payload } from "../payloads.ts";
import { fresh } from "../serial.ts";

// rb:wiring etag.*
/**
 * h3 answers a conditional request through handleCacheHeaders, which writes the ETag, compares it
 * with If-None-Match and sets 304 itself. It takes the tag as given and hashes nothing, so the
 * handler serialises the answer and hashes it with SHA-1 on every request. The body is built and
 * hashed before anything is compared, so a 304 saves the write and nothing else.
 */
function tagged(event: H3Event, answer: Payload): string | null {
  const body = JSON.stringify(answer);
  if (handleCacheHeaders(event, { etag: `"${createHash("sha1").update(body).digest("base64url")}"` })) return null;
  event.res.headers.set("content-type", "application/json;charset=UTF-8");
  return body;
}
// rb:end

/** etag: the answer tagged by its hash, and a matching If-None-Match answered 304. */
const etag: Routes = (app, p) => {
  app.get("/etag/small", (event) => tagged(event, fresh(event, p.small)));

  app.get("/etag/large", (event) => tagged(event, fresh(event, p.large)));
};

export default etag;
