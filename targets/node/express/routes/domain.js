// domain: application-shaped handler work and the write methods.
import express from "express";

import * as d from "../../_shared/domain.js";

const parse = express.json({ limit: "4mb" });

const send = (res, v, status = 200) =>
  v === d.NOT_FOUND ? res.status(404).json(d.notFoundBody()) : res.status(status).json(v);

export default function domain(app) {
  app.get("/domain/orders", (req, res) => res.json(d.domainFilter(req.query)));

  app.post("/domain/orders", parse, (req, res) =>
    res.status(201).location(d.createdLocation()).json(d.validateOrder(req.body)));

  app.get("/domain/orders/:oid", (req, res) => send(res, d.getOrder(req.params.oid)));

  app.put("/domain/orders/:oid", parse, (req, res) =>
    d.getOrder(req.params.oid) === d.NOT_FOUND
      ? res.status(404).json(d.notFoundBody())
      : res.json({ id: Number(req.params.oid), ...d.validateOrder(req.body) }));

  app.get("/domain/customers/:cid/summary", (req, res) =>
    send(res, d.domainJoin(req.params.cid)));

  app.get("/domain/regions/:r/report", (req, res) =>
    send(res, d.domainAggregate(req.params.r)));

  app.patch("/domain/customers/:cid", parse, (req, res) =>
    send(res, d.patchCustomer(req.params.cid, req.body)));

  app.delete("/domain/orders/:oid/lines/:lid", (req, res) =>
    d.getOrderLine(req.params.oid, req.params.lid) === d.NOT_FOUND
      ? res.status(404).json(d.notFoundBody())
      : res.status(204).end());
}
