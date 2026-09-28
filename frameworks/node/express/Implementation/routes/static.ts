import express from "express";

import type { Routes } from "../app.ts";

/** static: express.static, Express's own static-file middleware, serving the payload directory under /static/. */
const files: Routes = (app, p) => {
  // rb:handler static.large,static.medium,static.small
  // rb:wiring static.*
  app.use("/static", express.static(p.directory));
};

export default files;
