// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// Hono's own compress middleware, mounted on this path alone. On the app it would put a
// "did the client ask?" check on all forty-five endpoints and contaminate the rows this
// family is measured against.
//
// It is the one compressor here with no level setting: Hono compresses through the
// platform's CompressionStream, which takes none. The comparison is unaffected because the
// gate decompresses before it compares, but the time is not the pinned level's.
import { compress } from "hono/compress";

import * as d from "../../_shared/domain.js";

export default function compressed(app) {
  app.use("/compressed/*", compress({ encoding: "gzip" }));

  // rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
  // rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
  for (const size of ["small", "medium", "large"]) {
    app.get("/compressed/" + size, (c) => {
      c.header("x-rb-serial", d.nextSerial());
      return c.json(d.payload(size));
    });
  }
}
