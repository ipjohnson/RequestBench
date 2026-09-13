// RequestBench bare baseline for Node: node:http with a hand-written router.
// No framework, no dependencies. Everything else in the node shard is reported as a
// ratio to this. Responses are serialized per request, never cached, so the comparison
// against a framework stays honest.
import { createServer } from "node:http";
import * as d from "../_shared/domain.js";

const PORT = Number(process.env.PORT ?? 8080);

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { "content-type": "application/json",
                          "content-length": buf.length });
  res.end(buf);
}
function text(res, status, body) {
  const buf = Buffer.from(body);
  res.writeHead(status, { "content-type": "text/plain", "content-length": buf.length });
  res.end(buf);
}
const notFound = (res) => json(res, 404, { error: "not_found" });
const send = (res, v, status = 200) =>
  v === d.NOT_FOUND ? notFound(res) : json(res, status, v);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new d.ValidationError([{ field: "body", rule: "json" }])); }
    });
    req.on("error", reject);
  });
}

function route(req, res, seg, q, body) {
  const m = req.method;
  const n = seg.length;

  if (m === "GET") {
    if (n === 1) {
      switch (seg[0]) {
        case "plaintext": return text(res, 200, "Hello, World!");
        case "health":    return text(res, 200, "ok");
        case "products":  return json(res, 200, d.listProducts(q));
        case "customers": return json(res, 200, d.listCustomers(q));
        case "orders":    return json(res, 200, d.listOrders(q));
        case "search":    return json(res, 200, d.search(q));
        case "dashboard": return json(res, 200, d.dashboard());
        case "boom":      throw new d.Boom();
        case "forbidden": return json(res, 403, { error: "forbidden" });
      }
    } else if (n === 2) {
      if (seg[0] === "json" && seg[1] === "small") return json(res, 200, d.jsonSmall());
      if (seg[0] === "products")  return send(res, d.getProduct(seg[1]));
      if (seg[0] === "customers") return send(res, d.getCustomer(seg[1]));
      if (seg[0] === "orders")    return send(res, d.getOrder(seg[1]));
    } else if (n === 3) {
      if (seg[0] === "products" && seg[2] === "reviews") return send(res, d.getProductReviews(seg[1]));
      if (seg[0] === "products" && seg[2] === "related") return send(res, d.relatedProducts(seg[1]));
      if (seg[0] === "customers" && seg[2] === "orders") return send(res, d.getCustomerOrders(seg[1]));
      if (seg[0] === "customers" && seg[2] === "summary") return send(res, d.customerSummary(seg[1]));
      if (seg[0] === "orders" && seg[2] === "lines") return send(res, d.getOrderLines(seg[1]));
      if (seg[0] === "orders" && seg[2] === "full")  return send(res, d.orderFull(seg[1]));
      if (seg[0] === "regions" && seg[2] === "customers") return send(res, d.getRegionCustomers(seg[1]));
      if (seg[0] === "regions" && seg[2] === "report")    return send(res, d.regionReport(seg[1]));
    } else if (n === 4) {
      if (seg[0] === "customers" && seg[2] === "orders") return send(res, d.getCustomerOrder(seg[1], seg[3]));
      if (seg[0] === "orders" && seg[2] === "lines")     return send(res, d.getOrderLine(seg[1], seg[3]));
    } else if (n === 8) {
      if (seg[0] === "regions" && seg[2] === "customers" && seg[4] === "orders" && seg[6] === "lines")
        return send(res, d.getOrderLine(seg[5], seg[7]));
    }
    return notFound(res);
  }

  if (m === "POST") {
    if (n === 1) {
      if (seg[0] === "echo")   return json(res, 200, d.echo(body));
      if (seg[0] === "orders") return json(res, 201, d.validateOrder(body));
    } else if (n === 2) {
      if (seg[0] === "orders"    && seg[1] === "validate") return json(res, 200, d.validateOrder(body));
      if (seg[0] === "customers" && seg[1] === "validate") return json(res, 200, d.validateCustomer(body));
      if (seg[0] === "products"  && seg[1] === "validate") return json(res, 200, d.validateProduct(body));
    } else if (n === 3) {
      if (seg[0] === "orders" && seg[2] === "lines") {
        if (d.getOrder(seg[1]) === d.NOT_FOUND) return notFound(res);
        return json(res, 201, d.validateLine(body));
      }
    }
    return notFound(res);
  }

  if (m === "PUT" && n === 2 && seg[0] === "orders") {
    if (d.getOrder(seg[1]) === d.NOT_FOUND) return notFound(res);
    return json(res, 200, { id: Number(seg[1]), ...d.validateOrder(body) });
  }
  if (m === "PATCH" && n === 2 && seg[0] === "customers")
    return send(res, d.patchCustomer(seg[1], body));
  if (m === "DELETE" && n === 4 && seg[0] === "orders" && seg[2] === "lines") {
    if (d.getOrderLine(seg[1], seg[3]) === d.NOT_FOUND) return notFound(res);
    res.writeHead(204); return res.end();
  }
  return notFound(res);
}

const server = createServer((req, res) => {
  const qi = req.url.indexOf("?");
  const path = qi === -1 ? req.url : req.url.slice(0, qi);
  const q = qi === -1 ? {} : Object.fromEntries(new URLSearchParams(req.url.slice(qi + 1)));
  const seg = path.split("/").filter(Boolean);

  const run = (body) => {
    try {
      route(req, res, seg, q, body);
    } catch (err) {
      if (err instanceof d.ValidationError)
        return json(res, 422, { error: "validation_failed", errors: err.errors });
      json(res, 500, { error: "internal", message: err.message });
    }
  };

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    readBody(req).then(run).catch((err) =>
      err instanceof d.ValidationError
        ? json(res, 422, { error: "validation_failed", errors: err.errors })
        : json(res, 500, { error: "internal", message: err.message }));
  } else {
    run(undefined);
  }
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(PORT, () => console.log(`baseline listening on ${PORT}`));
