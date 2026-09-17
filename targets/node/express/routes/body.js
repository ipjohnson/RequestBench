// body: the parser and the validator, with size crossed against validation.
//
// express.json() is mounted on these five routes rather than on the app. On the app it
// would look for a body on all forty-five endpoints, including the thirty-eight that never
// send one, and body.bind_small minus json.small would stop being the parser.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. Express has no validation layer, so the walk
// this target holds in validation.js is what runs, in the handler.
import express from "express";

import * as d from "../../_shared/domain.js";
import { checkOrder, orderOf, refused } from "../validation.js";

const parse = express.json({ limit: "4mb" });

const validated = (firstError) => (req, res) => {
  const errs = checkOrder(req.body, firstError);
  if (errs.length) return res.status(422).json(refused(errs));
  return res.json(orderOf(req.body));
};

export default function body(app) {
  app.post("/body/bind/small", parse, (req, res) => res.json(d.bindEcho(req.body)));

  app.post("/body/bind/medium", parse, (req, res) => res.json(d.bindEcho(req.body)));

  app.post("/body/validate/small", parse, validated(false));

  app.post("/body/validate/medium", parse, validated(false));

  app.post("/body/validate/first-error", parse, validated(true));
}
