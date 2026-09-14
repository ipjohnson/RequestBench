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
const HTML_CT = { "content-type": "text/html; charset=utf-8" };
const CACHEABLE = "public, max-age=60";

const json = (status, value, headers) => ({
  status, headers: { ...JSON_CT, ...headers }, body: JSON.stringify(value),
});
const text = (status, body) => ({ status, headers: TEXT_CT, body });
const notFound = () => json(404, { error: "not_found" });
const send = (v, status = 200, headers) =>
  v === d.NOT_FOUND ? notFound() : json(status, v, headers);

const SIZES = new Set(["small", "medium", "large"]);

// No framework here, so a middleware layer is a plain function that calls the next and
// does nothing else. The chains are built once, the way a framework registers its own, so
// what the request pays is walking them. This is the floor the frameworks are read against.
const layer = (next) => (req) => next(req);
function chain(n, final) {
  let f = final;
  for (let i = 0; i < n; i++) f = layer(f);
  return f;
}
const small = () => json(200, d.payload("small"));
const MIDDLEWARE = { none: chain(0, small), four: chain(4, small), sixteen: chain(16, small) };

function compressed(size) {
  // Per request, at the pinned level. compressed.small exists because gzip turns 125 bytes
  // into 125 bytes, so it is the cost of achieving nothing.
  const body = d.gzip(Buffer.from(JSON.stringify(d.payload(size))));
  return { status: 200, body,
           headers: { ...JSON_CT, "content-encoding": "gzip", "x-rb-serial": d.nextSerial() } };
}

function cached(size, headers) {
  // The ETag is pinned in the fixture, so what is measured is emitting the header and
  // comparing it, not hashing the body. Hash cost belongs in Suite B.
  const etag = d.etagOf(size);
  const common = { etag, "cache-control": CACHEABLE, "x-rb-serial": d.nextSerial() };
  if (headers["if-none-match"] === etag)
    return { status: 304, headers: common, body: "" };
  return { status: 200, headers: { ...JSON_CT, ...common },
           body: JSON.stringify(d.payload(size)) };
}

// ---- routing: method + path segments + query + parsed body + headers -> result --------

function route(method, seg, q, body, headers) {
  const n = seg.length;

  if (method === "GET") {
    if (n === 1) {
      switch (seg[0]) {
        case "plaintext": return text(200, "Hello, World!");
        // The handler reads no header at all: headers.many minus headers.few is then the
        // cost of materialising 27 nobody asked for.
        case "headers":   return json(200, d.payload("small"));
        case "health":    return text(200, "ok");
        case "__meta":    return json(200, { ...meta, ...hostMeta() });
      }
    } else if (n === 2) {
      switch (seg[0]) {
        case "json":       if (SIZES.has(seg[1])) return json(200, d.payload(seg[1])); break;
        case "compressed": if (SIZES.has(seg[1])) return compressed(seg[1]); break;
        case "cached":     if (SIZES.has(seg[1])) return cached(seg[1], headers); break;
        case "template":
          if (seg[1] === "small" || seg[1] === "medium")
            return { status: 200, headers: HTML_CT, body: d.renderItems(seg[1]) };
          break;
        case "authorized":
          if (seg[1] === "small")
            return d.tokenOk(headers["authorization"])
              ? json(200, d.payload("small")) : json(403, { error: "forbidden" });
          break;
        case "middleware": {
          const mw = MIDDLEWARE[seg[1]];
          if (mw) return mw(null);
          break;
        }
        case "query":
          if (seg[1] === "one")  return json(200, d.coerceOne(q));
          if (seg[1] === "many") return json(200, d.coerceMany(q));
          break;
        case "parameters": return json(200, d.payload("small"));
        case "domain":     if (seg[1] === "orders") return json(200, d.domainFilter(q)); break;
      }
    } else if (n === 3) {
      if (seg[0] === "domain" && seg[1] === "orders") return send(d.getOrder(seg[2]));
    } else if (n === 4) {
      if (seg[0] === "parameters") {
        if (seg[1] === "static" && seg[2] === "segment" && seg[3] === "literal")
          return json(200, d.payload("small"));
        if (seg[2] === "with-second") return json(200, d.payload("small"));
      }
      if (seg[0] === "domain") {
        if (seg[1] === "customers" && seg[3] === "summary") return send(d.domainJoin(seg[2]));
        if (seg[1] === "regions"   && seg[3] === "report")  return send(d.domainAggregate(seg[2]));
      }
    }
    return notFound();
  }

  if (method === "POST") {
    if (n === 2 && seg[0] === "domain" && seg[1] === "orders")
      return json(201, d.validateOrder(body), { location: "/domain/orders/" + d.NEXT_ORDER_ID });
    if (n === 3 && seg[0] === "body") {
      // bind parses and binds without validating, so validate minus bind is the validator
      // alone rather than the validator plus the parse.
      if (seg[1] === "bind" && SIZES.has(seg[2])) return json(200, d.bindEcho(body));
      if (seg[1] === "validate") {
        if (SIZES.has(seg[2]))            return json(200, d.validateOrder(body));
        if (seg[2] === "first-error")     return json(200, d.validateOrder(body, true));
      }
    }
    return notFound();
  }

  if (method === "PUT" && n === 3 && seg[0] === "domain" && seg[1] === "orders") {
    const o = d.getOrder(seg[2]);
    if (o === d.NOT_FOUND) return notFound();
    return json(200, { id: o.id, ...d.validateOrder(body) });
  }
  if (method === "PATCH" && n === 3 && seg[0] === "domain" && seg[1] === "customers")
    return send(d.patchCustomer(seg[2], body));
  if (method === "DELETE" && n === 5 && seg[0] === "domain" && seg[1] === "orders"
      && seg[3] === "lines") {
    if (d.getOrderLine(seg[2], seg[4]) === d.NOT_FOUND) return notFound();
    return { status: 204, headers: {}, body: "" };
  }
  return notFound();
}

const meta = { framework: "node-http", version: process.versions.node,
               runtime: "node " + process.versions.node,
               // Declared so the template row is never read as a renderer it is not. A bare
               // baseline has no engine, and saying so is what keeps it out of that column.
               template: "string-concat" };

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
  // A compressed response is already bytes. Buffer.from on a Buffer copies it, which would
  // charge every compressed.* response for a second pass over the body.
  const buf = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body ?? "");
  const headers = { ...r.headers };
  const noBody = r.status === 204 || r.status === 304;
  if (!noBody) headers["content-length"] = buf.length;
  res.writeHead(r.status, headers);
  res.end(noBody ? undefined : buf);
}

export function handler(req, res) {
  const qi = req.url.indexOf("?");
  const path = qi === -1 ? req.url : req.url.slice(0, qi);
  const q = qi === -1 ? {} : Object.fromEntries(new URLSearchParams(req.url.slice(qi + 1)));
  const seg = split(path);
  const run = (body) => {
    try { write(res, route(req.method, seg, q, body, req.headers)); }
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
                          split(event.rawPath), event.queryStringParameters ?? {}, body,
                          lower(event.headers ?? {})));
  } catch (err) {
    return asResult(onError(err));
  }
}

// API Gateway lowercases header names; a hand-built event might not, and the authorization
// and if-none-match reads are the only places that would notice.
const lower = (h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

const asResult = (r) => {
  const binary = Buffer.isBuffer(r.body);
  const bytes = binary ? r.body.length : Buffer.byteLength(r.body ?? "");
  return {
    statusCode: r.status,
    headers: r.status === 204 || r.status === 304 ? r.headers
           : { ...r.headers, "content-length": String(bytes) },
    body: binary ? r.body.toString("base64") : (r.body ?? ""),
    isBase64Encoded: binary,
  };
};
