// rb:wiring etag.*
// etag: h3's own cache utility answers the conditional.
//
// handleCacheHeaders writes the validator and the cache-control, compares it against
// if-none-match and sets the 304 itself. What it does not do is hash: it takes the tag as
// an argument, because h3 ships no digest. So the digest is the target's, declared in
// /__meta, and it runs per request over the body about to be sent rather than being looked
// up. Serializing here rather than returning the object is what gives it bytes to hash.
import { defineHandler, handleCacheHeaders } from "h3";
import { createHash } from "node:crypto";

import * as d from "../../_shared/domain.js";

// rb:wiring etag.*
const MAX_AGE = 60;

export default function etag(app) {
  // rb:handler etag.*
  for (const size of ["small", "large"]) {
    app.get("/etag/" + size, defineHandler((e) => {
      const body = JSON.stringify(d.payload(size));
      const tag = '"' + createHash("sha1").update(body).digest("base64") + '"';
      e.res.headers.set("x-rb-serial", d.nextSerial());
      if (handleCacheHeaders(e, { etag: tag, maxAge: MAX_AGE })) return null;
      e.res.headers.set("content-type", "application/json");
      return body;
    }));
  }
}
