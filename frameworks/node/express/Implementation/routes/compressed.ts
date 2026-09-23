import { constants } from "node:zlib";

// rb:wiring compressed.*
import compression from "compression";

import type { Routes } from "../app.ts";
import { serial } from "../serial.ts";

/**
 * compressed: these routes answer like any other, and compression, the expressjs middleware in
 * their handler lists, gzips the answer when the request asks for it.
 */
const compressed: Routes = (app, p) => {
  // rb:wiring compressed.*
  // In the handler list of these two routes and of no other. The threshold is the package's
  // default, so a body under 1 KB goes out as it is, and the level is the fastest zlib offers, which
  // every framework here compresses at.
  const gzip = compression({ level: constants.Z_BEST_SPEED });

  app.get("/compressed/small", gzip, (_request, response) => serial(response).json(p.small));

  app.get("/compressed/large", gzip, (_request, response) => serial(response).json(p.large));
};

export default compressed;
