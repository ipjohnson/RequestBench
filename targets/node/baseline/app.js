// RequestBench bare baseline for Node. No framework, no dependencies.
//
// Routing returns a plain {status, headers, body} result rather than writing to a socket,
// so the same routing serves three transports without one wrapping another:
//
//   listen(port)   node:http server           -- the container host
//   handler(req,res)  a (req, res) function   -- a host that brings its own server
//   lambda(event)  an API Gateway v2 handler  -- the Lambda runtime, no HTTP at all
//
// The Lambda path is hand-written rather than a shim over the HTTP path, because the
// point of a bare baseline is to be the floor for its host, not a translation of another.
import { createServer } from "node:http";
import { hostMeta } from "../_shared/host.js";
import * as d from "../_shared/domain.js";

const JSON_CT = { "content-type": "application/json" };
const TEXT_CT = { "content-type": "text/plain" };

const json = (status, value, headers) => ({
  status, headers: { ...JSON_CT, ...headers }, body: JSON.stringify(value),
});
const text = (status, body) => ({ status, headers: TEXT_CT, body });
const notFound = () => json(404, { error: "not_found" });
const send = (v, status = 200, headers) =>
  v === d.NOT_FOUND ? notFound() : json(status, v, headers);

// ---- routing: method + path segments + query + parsed body -> result -----------------

function route(method, seg, q, body) {
  const n = seg.length;

  if (method === "GET") {
    if (n === 1) {
      switch (seg[0]) {
        case "plaintext": return text(200, "Hello, World!");
        case "health":    return text(200, "ok");
        case "__meta":    return json(200, { ...meta, ...hostMeta() });
        case "products":  return json(200, d.listProducts(q));
        case "customers": return json(200, d.listCustomers(q));
        case "orders":    return json(200, d.listOrders(q));
        case "search":    return json(200, d.search(q));
        case "dashboard": return json(200, d.dashboard());
        case "boom":      throw new d.Boom();
        case "forbidden": return json(403, { error: "forbidden" });
      }
    } else if (n === 2) {
      if (seg[0] === "json" && seg[1] === "small") return json(200, d.jsonSmall());
      if (seg[0] === "products")  return send(d.getProduct(seg[1]));
      if (seg[0] === "customers") return send(d.getCustomer(seg[1]));
      if (seg[0] === "orders")    return send(d.getOrder(seg[1]));
    } else if (n === 3) {
      if (seg[0] === "products"  && seg[2] === "reviews") return send(d.getProductReviews(seg[1]));
      if (seg[0] === "products"  && seg[2] === "related") return send(d.relatedProducts(seg[1]));
      if (seg[0] === "customers" && seg[2] === "orders")  return send(d.getCustomerOrders(seg[1]));
      if (seg[0] === "customers" && seg[2] === "summary") return send(d.customerSummary(seg[1]));
      if (seg[0] === "orders"    && seg[2] === "lines")   return send(d.getOrderLines(seg[1]));
      if (seg[0] === "orders"    && seg[2] === "full")    return send(d.orderFull(seg[1]));
      if (seg[0] === "regions"   && seg[2] === "customers") return send(d.getRegionCustomers(seg[1]));
      if (seg[0] === "regions"   && seg[2] === "report")    return send(d.regionReport(seg[1]));
    } else if (n === 4) {
      if (seg[0] === "customers" && seg[2] === "orders") return send(d.getCustomerOrder(seg[1], seg[3]));
      if (seg[0] === "orders"    && seg[2] === "lines")  return send(d.getOrderLine(seg[1], seg[3]));
    } else if (n === 8) {
      if (seg[0] === "regions" && seg[2] === "customers" && seg[4] === "orders" && seg[6] === "lines")
        return send(d.getOrderLine(seg[5], seg[7]));
    }
    return notFound();
  }

  if (method === "POST") {
    if (n === 1) {
      if (seg[0] === "echo") return json(200, d.echo(body));
      if (seg[0] === "orders")
        return json(201, d.validateOrder(body), { location: "/orders/" + d.NEXT_ORDER_ID });
    } else if (n === 2) {
      if (seg[0] === "orders"    && seg[1] === "validate") return json(200, d.validateOrder(body));
      if (seg[0] === "customers" && seg[1] === "validate") return json(200, d.validateCustomer(body));
      if (seg[0] === "products"  && seg[1] === "validate") return json(200, d.validateProduct(body));
    } else if (n === 3 && seg[0] === "orders" && seg[2] === "lines") {
      const o = d.getOrder(seg[1]);
      if (o === d.NOT_FOUND) return notFound();
      return json(201, d.validateLine(body),
                  { location: `/orders/${seg[1]}/lines/${o.lines.length + 1}` });
    }
    return notFound();
  }

  if (method === "PUT" && n === 2 && seg[0] === "orders") {
    const o = d.getOrder(seg[1]);
    if (o === d.NOT_FOUND) return notFound();
    return json(200, { id: o.id, ...d.validateOrder(body) });
  }
  if (method === "PATCH" && n === 2 && seg[0] === "customers")
    return send(d.patchCustomer(seg[1], body));
  if (method === "DELETE" && n === 4 && seg[0] === "orders" && seg[2] === "lines") {
    if (d.getOrderLine(seg[1], seg[3]) === d.NOT_FOUND) return notFound();
    return { status: 204, headers: {}, body: "" };
  }
  return notFound();
}

const meta = { framework: "node-http", version: process.versions.node,
               runtime: "node " + process.versions.node };

function onError(err) {
  if (err instanceof d.ValidationError)
    return json(422, { error: "validation_failed", errors: err.errors });
  return json(500, { error: "internal", message: err.message });
}

const split = (path) => path.split("/").filter(Boolean);
const HAS_BODY = new Set(["POST", "PUT", "PATCH"]);

// ---- transport 1 and 2: a node:http server, and a bare (req, res) --------------------

function readBody(req) {
  // A function host parses the body before the handler runs and hands over a consumed
  // stream. Waiting on "end" there waits forever, so take what the host already parsed.
  if (req.body !== undefined) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new d.ValidationError([{ field: "body", rule: "json" }])); }
    });
    req.on("error", reject);
  });
}

function write(res, r) {
  const buf = Buffer.from(r.body ?? "");
  const headers = { ...r.headers };
  if (r.status !== 204) headers["content-length"] = buf.length;
  res.writeHead(r.status, headers);
  res.end(r.status === 204 ? undefined : buf);
}

export function handler(req, res) {
  const qi = req.url.indexOf("?");
  const path = qi === -1 ? req.url : req.url.slice(0, qi);
  const q = qi === -1 ? {} : Object.fromEntries(new URLSearchParams(req.url.slice(qi + 1)));
  const seg = split(path);
  const run = (body) => {
    try { write(res, route(req.method, seg, q, body)); }
    catch (err) { write(res, onError(err)); }
  };
  if (HAS_BODY.has(req.method)) readBody(req).then(run, (err) => write(res, onError(err)));
  else run(undefined);
}

export function listen(port) {
  const server = createServer(handler);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return new Promise((r) => server.listen(port, () => r(server)));
}

// ---- transport 3: an API Gateway v2 event, no HTTP in the process --------------------

export async function lambda(event) {
  let body;
  if (event.body) {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    try { body = raw.length ? JSON.parse(raw) : undefined; }
    catch { return asResult(onError(new d.ValidationError([{ field: "body", rule: "json" }]))); }
  }
  try {
    return asResult(route(event.requestContext.http.method,
                          split(event.rawPath), event.queryStringParameters ?? {}, body));
  } catch (err) {
    return asResult(onError(err));
  }
}

const asResult = (r) => ({
  statusCode: r.status,
  headers: r.status === 204 ? r.headers
         : { ...r.headers, "content-length": String(Buffer.byteLength(r.body ?? "")) },
  body: r.body ?? "",
});
