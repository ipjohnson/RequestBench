// Domain logic shared by every Node target. Frameworks differ only in how they wire
// routes to these functions, so the measured delta is framework overhead and nothing else.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// A host decides the layout: the Lambda base image puts the task at /var/task, so the
// path relative to this file is not the same everywhere. RB_FIXTURE wins when set, which
// is how the Go targets already do it.
const fixturePath = process.env.RB_FIXTURE || join(here, "../../../spec/fixture.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

export const products = fixture.products;
export const customers = fixture.customers;
export const orders = fixture.orders;
export const reviews = fixture.reviews;

const productById = new Map(products.map((p) => [p.id, p]));
const customerById = new Map(customers.map((c) => [c.id, c]));
const orderById = new Map(orders.map((o) => [o.id, o]));
const ordersByCustomer = new Map();
for (const o of orders) {
  let list = ordersByCustomer.get(o.customer_id);
  if (!list) ordersByCustomer.set(o.customer_id, (list = []));
  list.push(o);
}
const customersByRegion = new Map();
for (const c of customers) {
  let list = customersByRegion.get(c.region);
  if (!list) customersByRegion.set(c.region, (list = []));
  list.push(c);
}

export const NOT_FOUND = Symbol("not_found");
// The fixture holds orders 1..1000, so a created one is 1001. Synthetic and deterministic,
// which is all a Location header needs when nothing is persisted.
export const NEXT_ORDER_ID = orders.length + 1;
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

export const getProduct  = (id) => productById.get(int(id))  ?? NOT_FOUND;
export const getCustomer = (id) => customerById.get(int(id)) ?? NOT_FOUND;
export const getOrder    = (id) => orderById.get(int(id))    ?? NOT_FOUND;
export const listProductsAll = () => products;
export const jsonSmall = () => ({ message: "Hello, World!" });

export function getOrderLines(orderId) {
  const o = orderById.get(int(orderId));
  return o ? o.lines : NOT_FOUND;
}
export function getOrderLine(orderId, lineId) {
  const o = orderById.get(int(orderId));
  if (!o) return NOT_FOUND;
  return o.lines.find((l) => l.id === int(lineId)) ?? NOT_FOUND;
}
export function getCustomerOrders(cid) {
  if (!customerById.has(int(cid))) return NOT_FOUND;
  return ordersByCustomer.get(int(cid)) ?? [];
}
export function getCustomerOrder(cid, oid) {
  const o = orderById.get(int(oid));
  if (!o || o.customer_id !== int(cid)) return NOT_FOUND;
  return o;
}
export function getProductReviews(pid) {
  if (!productById.has(int(pid))) return NOT_FOUND;
  return reviews[String(int(pid))] ?? [];
}
export function getRegionCustomers(region) {
  return customersByRegion.get(region) ?? NOT_FOUND;
}

// ---- query families -------------------------------------------------------

export function listOrders(q) {
  const page = Math.max(0, int(q.page) || 0);
  const size = Math.min(100, Math.max(1, int(q.size) || 25));
  let rows = orders;
  if (q.status) rows = rows.filter((o) => o.status === q.status);
  const start = page * size;
  return { page, size, total: rows.length, items: rows.slice(start, start + size) };
}
export function listProducts(q) {
  const min = int(q.min_price) || 0;
  const max = int(q.max_price) || Number.MAX_SAFE_INTEGER;
  let rows = products;
  if (q.category) rows = rows.filter((p) => p.category === q.category);
  if (q.min_price || q.max_price)
    rows = rows.filter((p) => p.price_cents >= min * 100 && p.price_cents <= max * 100);
  return { total: rows.length, items: rows };
}
export function listCustomers(q) {
  let rows = customers;
  if (q.q) rows = rows.filter((c) => c.name.includes(q.q) || c.email.includes(q.q));
  const key = q.sort === "created" ? "created" : "name";
  rows = rows.slice().sort((a, b) =>
    a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : a.id - b.id);
  return { total: rows.length, sort: key, items: rows.slice(0, 50) };
}
export function search(q) {
  const limit = Math.min(100, Math.max(1, int(q.limit) || 25));
  const offset = Math.max(0, int(q.offset) || 0);
  const term = q.q ?? "";
  const hits = products.filter((p) => p.name.includes(term));
  const key = q.sort === "total" ? "price_cents" : "name";
  const dir = q.dir === "desc" ? -1 : 1;
  hits.sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : a.id - b.id));
  return { term, limit, offset, sort: key, total: hits.length,
           items: hits.slice(offset, offset + limit) };
}

// ---- composition families -------------------------------------------------

export function customerSummary(cid) {
  const c = customerById.get(int(cid));
  if (!c) return NOT_FOUND;
  const os = ordersByCustomer.get(c.id) ?? [];
  return {
    customer: c, order_count: os.length,
    lifetime_cents: os.reduce((s, o) => s + o.total_cents, 0),
    by_status: os.reduce((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {}),
    recent: os.slice(-5).map((o) => ({ id: o.id, created: o.created, total_cents: o.total_cents })),
  };
}
export function orderFull(oid) {
  const o = orderById.get(int(oid));
  if (!o) return NOT_FOUND;
  return {
    ...o,
    customer: customerById.get(o.customer_id),
    lines: o.lines.map((l) => ({ ...l, product: productById.get(l.product_id) })),
  };
}
export function regionReport(region) {
  const cs = customersByRegion.get(region);
  if (!cs) return NOT_FOUND;
  const os = cs.flatMap((c) => ordersByCustomer.get(c.id) ?? []);
  return {
    region, customers: cs.length, orders: os.length,
    revenue_cents: os.reduce((s, o) => s + o.total_cents, 0),
    top: os.slice().sort((a, b) => b.total_cents - a.total_cents || a.id - b.id).slice(0, 10)
           .map((o) => ({ id: o.id, total_cents: o.total_cents })),
  };
}
export function relatedProducts(pid) {
  const p = productById.get(int(pid));
  if (!p) return NOT_FOUND;
  return { product: p,
           related: products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 10) };
}
export function dashboard() {
  return {
    products: products.length, customers: customers.length, orders: orders.length,
    revenue_cents: orders.reduce((s, o) => s + o.total_cents, 0),
    by_status: orders.reduce((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {}),
    by_region: [...customersByRegion].map(([r, cs]) => ({ region: r, customers: cs.length }))
                  .sort((a, b) => (a.region < b.region ? -1 : 1)),
  };
}

// ---- validation -----------------------------------------------------------

export class ValidationError extends Error {
  constructor(errors) { super("validation failed"); this.errors = errors; }
}
const req = (errs, obj, field, type) => {
  const v = obj?.[field];
  if (v === undefined || v === null) errs.push({ field, rule: "required" });
  else if (type === "int" && !Number.isInteger(v)) errs.push({ field, rule: "int" });
  else if (type === "string" && typeof v !== "string") errs.push({ field, rule: "string" });
  else if (type === "array" && !Array.isArray(v)) errs.push({ field, rule: "array" });
};

export function validateOrder(body, firstError = false) {
  const errs = [];
  // The two rejection contracts run the same walk in the same order and differ only in
  // whether it stops at the first error. That is what makes rejected_all minus
  // rejected_first the cost of not short-circuiting, stated as a number.
  const bail = () => firstError && errs.length > 0;
  req(errs, body, "customer_id", "int");
  if (!bail()) req(errs, body, "status", "string");
  if (!bail()) req(errs, body, "lines", "array");
  if (!bail() && Array.isArray(body?.lines)) {
    if (body.lines.length === 0) errs.push({ field: "lines", rule: "min_length" });
    for (let i = 0; i < body.lines.length && !bail(); i++) {
      const l = body.lines[i];
      if (!Number.isInteger(l?.product_id)) errs.push({ field: `lines[${i}].product_id`, rule: "int" });
      if (!bail() && (!Number.isInteger(l?.qty) || l.qty < 1)) errs.push({ field: `lines[${i}].qty`, rule: "min" });
    }
  }
  if (errs.length) throw new ValidationError(errs);
  const lines = body.lines.map((l, i) => {
    const p = productById.get(l.product_id);
    const unit = p ? p.price_cents : 0;
    return { id: i + 1, product_id: l.product_id, qty: l.qty, unit_cents: unit,
             total_cents: unit * l.qty };
  });
  return { customer_id: body.customer_id, status: body.status, lines,
           total_cents: lines.reduce((s, l) => s + l.total_cents, 0) };
}
export function validateCustomer(body) {
  const errs = [];
  req(errs, body, "name", "string");
  req(errs, body, "email", "string");
  req(errs, body, "region", "string");
  if (typeof body?.email === "string" && !body.email.includes("@"))
    errs.push({ field: "email", rule: "format" });
  if (errs.length) throw new ValidationError(errs);
  return { name: body.name.trim(), email: body.email.toLowerCase(), region: body.region };
}
export function validateProduct(body) {
  const errs = [];
  req(errs, body, "name", "string");
  req(errs, body, "category", "string");
  req(errs, body, "price_cents", "int");
  if (Number.isInteger(body?.price_cents) && body.price_cents < 0)
    errs.push({ field: "price_cents", rule: "min" });
  if (errs.length) throw new ValidationError(errs);
  return { name: body.name, category: body.category, price_cents: body.price_cents };
}
export function validateLine(body) {
  const errs = [];
  req(errs, body, "product_id", "int");
  req(errs, body, "qty", "int");
  if (errs.length) throw new ValidationError(errs);
  const p = productById.get(body.product_id);
  const unit = p ? p.price_cents : 0;
  return { id: 1, product_id: body.product_id, qty: body.qty, unit_cents: unit,
           total_cents: unit * body.qty };
}
export function patchCustomer(cid, body) {
  const c = customerById.get(int(cid));
  if (!c) return NOT_FOUND;
  return { ...c, ...(body?.name ? { name: body.name } : {}),
                 ...(body?.region ? { region: body.region } : {}) };
}
export const echo = (body) => ({ received: body, bytes: JSON.stringify(body ?? null).length });
export class Boom extends Error { constructor() { super("deliberate unhandled failure"); } }

// ---- blend-v2 ---------------------------------------------------------------
//
// The payload is the controlled variable: three fixed responses that every feature family
// reuses unchanged, so subtracting a base endpoint from its arm leaves the feature and
// nothing else. Everything below is shared by every Node target, because a difference here
// would move all of them at once and stop being framework overhead.

export const payloads = fixture.payloads;
export const auth = fixture.auth;

// Not pre-serialized. json.small against json.large is one fixture read, one serialize and
// one write at three sizes; handing back a cached string would measure none of it.
export const payload = (size) => payloads[size].body;
export const etagOf = (size) => payloads[size].etag;

// The strings every target answers with. Spelled once so five targets cannot drift on a
// word, which is the kind of difference that reads as a framework result.
export const CACHEABLE = "public, max-age=60";
export const notFoundBody = () => ({ error: "not_found" });
export const forbiddenBody = () => ({ error: "forbidden" });
export const invalidBody = (errors) => ({ error: "validation_failed", errors });
export const malformed = () => new ValidationError([{ field: "body", rule: "json" }]);
export const createdLocation = () => "/domain/orders/" + NEXT_ORDER_ID;

export const GZIP_LEVEL = 6;
export const gzip = (buf) => gzipSync(buf, { level: GZIP_LEVEL });

// x-rb-serial, monotonic per process. A response served from a cache anywhere in the path,
// or precomputed at boot, repeats a number it did not increment. Identical bytes are the
// whole point of the fingerprint, so nothing else can tell the two apart.
let serial = 0;
export const nextSerial = () => String(++serial);

// The denial arm's token differs only in its last character, so this walks the whole string
// rather than failing on length. Crypto is not framework cost; Suite B has the JWT arm.
export const tokenOk = (header) =>
  typeof header === "string" && header.startsWith("Bearer ") && header.slice(7) === auth.token;

// Leaf count. Without a field derived from the parsed structure a target can pipe request
// bytes straight to the response and never parse, and conformance would not see it: the
// fingerprint sorts keys before hashing, so even a reordering is invisible.
export function leafCount(v) {
  if (Array.isArray(v)) {
    let n = 0;
    for (const x of v) n += leafCount(x);
    return n;
  }
  if (v !== null && typeof v === "object") {
    let n = 0;
    for (const k in v) n += leafCount(v[k]);
    return n;
  }
  return 1;
}

export const bindEcho = (body) => ({
  fields: leafCount(body), bytes: JSON.stringify(body ?? null).length, echo: body,
});

// Query coercion. The response has to echo the coerced values or the parse can be skipped
// and the endpoint measures nothing.
export const coerceOne = (q) => ({ page: int(q.page) || 0 });
export const coerceMany = (q) => ({
  page: int(q.page) || 0, size: int(q.size) || 0, status: q.status ?? null,
  category: q.category ?? null, sort: q.sort ?? null, q: q.q ?? null,
  min_price: int(q.min_price) || 0, max_price: int(q.max_price) || 0,
});

// §4 pins the work these three do. Conformance compares bytes, and a precomputed page
// produces the same bytes as a computed one, so this is the one family where two
// conforming implementations can do wildly different amounts of work.
export function domainFilter(q) {
  const page = Math.max(0, int(q.page) || 0);
  const size = Math.min(100, Math.max(1, int(q.size) || 25));
  const rows = [];
  for (const o of orders) if (o.status === q.status) rows.push(o);
  const start = page * size;
  return { page, size, total: rows.length, items: rows.slice(start, start + size) };
}

export function domainJoin(cid) {
  const c = customerById.get(int(cid));
  if (!c) return NOT_FOUND;
  let orderCount = 0, lifetime = 0, lineCount = 0, units = 0;
  const recent = [];
  for (const o of orders) {
    if (o.customer_id !== c.id) continue;
    orderCount++;
    lifetime += o.total_cents;
    for (const l of o.lines) { lineCount++; units += l.qty; }
    recent.push({ id: o.id, created: o.created, total_cents: o.total_cents });
  }
  return { customer: c, order_count: orderCount, lifetime_cents: lifetime,
           line_count: lineCount, units, recent: recent.slice(-5) };
}

export function domainAggregate(region) {
  const inRegion = new Set();
  for (const c of customers) if (c.region === region) inRegion.add(c.id);
  if (inRegion.size === 0) return NOT_FOUND;
  let orderCount = 0, revenue = 0;
  const top = [];
  for (const o of orders) {
    if (!inRegion.has(o.customer_id)) continue;
    orderCount++;
    revenue += o.total_cents;
    top.push({ id: o.id, total_cents: o.total_cents });
  }
  top.sort((a, b) => b.total_cents - a.total_cents || a.id - b.id);
  return { region, customers: inRegion.size, orders: orderCount,
           revenue_cents: revenue, top: top.slice(0, 10) };
}

// One template, one model, the expected output generated into the fixture. Content is
// pinned and whitespace is free, which is how five engines can agree without every
// template being contorted to match.
export function renderItems(size) {
  const model = payloads[size].body;
  let out = "<!doctype html><html><head><title>items</title></head><body><h1>" + model.size +
    "</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th>" +
    "<th>stock</th></tr></thead><tbody>";
  for (const it of model.items) {
    out += "<tr><td>" + it.id + "</td><td>" + it.name + "</td><td>" + it.category +
           "</td><td>" + it.price_cents + "</td><td>" + (it.in_stock ? "yes" : "no") +
           "</td></tr>";
  }
  return out + "</tbody></table><p>" + model.count + " rows</p></body></html>";
}
