// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// koa-compress mounted on these three routes alone. On the application it would put a "did
// the client ask?" check on all forty-five endpoints and contaminate the rows this family
// is measured against.
// rb:wiring compressed.*
import compress from "koa-compress";
import zlib from "node:zlib";

import * as d from "../../_shared/domain.js";

// Level is pinned across every language. The size threshold is left at the library's own
// default, because whether a framework bothers to compress a body too small to benefit is
// what compressed.gzip_small is in the set to show.
// rb:wiring compressed.*
const gzip = compress({ br: false, deflate: false, gzip: { level: d.GZIP_LEVEL } });

export default function compressed(router) {
  // rb:handler compressed.*
  for (const size of ["small", "medium", "large"]) {
    router.get("/compressed/" + size, gzip, (ctx) => {
      ctx.set("x-rb-serial", d.nextSerial());
      ctx.body = d.payload(size);
    });
  }
}
