// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// Hono's own compress middleware, mounted on this path alone. On the app it would put a
// "did the client ask?" check on all forty-five endpoints and contaminate the rows this
// family is measured against.
//
// It is the one compressor here with no level setting: Hono compresses through the
// platform's CompressionStream, which takes none. Node's runs at zlib's default level, 6.
// rb:wiring compressed.*
import { compress } from "hono/compress";

import * as d from "../../_shared/domain.js";

export default function compressed(app) {
  // rb:wiring compressed.*
  app.use("/compressed/*", compress({ encoding: "gzip" }));

  // rb:handler compressed.*
  for (const size of ["small", "medium", "large"]) {
    app.get("/compressed/" + size, (c) => {
      c.header("x-rb-serial", d.nextSerial());
      return c.json(d.payload(size));
    });
  }
}
