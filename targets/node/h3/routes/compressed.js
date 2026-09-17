// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// h3 ships no compression, so the codec is the pinned one every language shares, applied
// in route-scoped middleware. On the app it would put a "did the client ask?" check on all
// forty-five endpoints and contaminate the rows this family is measured against.
import { defineHandler } from "h3";

import * as d from "../../_shared/domain.js";

// The threshold is the one the Node compressors default to, so compressed.gzip_small lands
// on the same side of it here as it does in the other four targets.
// rb:wiring compressed.*
const THRESHOLD = 1024;

// rb:wiring compressed.*
const gzip = async (e, next) => {
  const value = await next();
  const raw = Buffer.from(JSON.stringify(value));
  const accepts = (e.req.headers.get("accept-encoding") || "").includes("gzip");
  if (!accepts || raw.length < THRESHOLD) {
    return new Response(raw, {
      status: 200,
      headers: { "content-type": "application/json", ...headersOf(e) },
    });
  }
  const packed = d.gzip(raw);
  return new Response(packed, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-encoding": "gzip",
      vary: "Accept-Encoding",
      ...headersOf(e),
    },
  });
};

// rb:wiring compressed.*
const headersOf = (e) => Object.fromEntries(e.res.headers.entries());

export default function compressed(app) {
  // rb:handler compressed.*
  for (const size of ["small", "medium", "large"]) {
    app.get("/compressed/" + size, defineHandler({
      middleware: [gzip],
      handler: (e) => {
        e.res.headers.set("x-rb-serial", d.nextSerial());
        return d.payload(size);
      },
    }));
  }
}
