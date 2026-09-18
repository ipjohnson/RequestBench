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

// ---- the order body, after validation ---------------------------------------
// Validating is the framework's own job and lives in each target: fastify declares a
// schema.body and lets ajv run it, hono runs its rules through hono/validator, and
// express, koa and h3 hold their own because none of the three has a validation layer
// to use. What is left here is what happens once a body is known to be good, which is
// the same work whichever framework proved it.

/**
 * The work after the validator says yes: look each product up, carry the unit price onto
 * the line, and total it. Identical in every framework, which is why it is here and the
 * validating is not.
 */
export function priceOrder(customer_id, status, lines) {
  const priced = lines.map((l, i) => {
    const p = productById.get(l.product_id);
    const unit = p ? p.price_cents : 0;
    return { id: i + 1, product_id: l.product_id, qty: l.qty, unit_cents: unit,
             total_cents: unit * l.qty };
  });
  return { customer_id, status, lines: priced,
           total_cents: priced.reduce((s, l) => s + l.total_cents, 0) };
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
// one write at three sizes; handing back a stored string would measure none of it.
export const payload = (size) => payloads[size].body;

// The payload with what a handler bound beside it. A route that binds something answers
// this, so the value has to be converted and written back rather than bound and dropped.
export const withEcho = (size, echo) => ({ ...payloads[size].body, echo });

// ---- the etag and cache families --------------------------------------------------
//
// No ETag value here. Each framework's own conditional machinery computes the validator
// from the body it is about to send, so it differs by target and each one declares its
// digest in /__meta. A driver reads the tag off a first response rather than looking it up.
//
// What is shared is the store's shape. The key count is derived in the fixture from the
// vary values the plan sends, because a store smaller than that evicts inside the measured
// window and the family would report eviction policy instead of the feature.
export const cacheSpec = fixture.cache;
export const CACHE_TTL_MS = fixture.cache.ttl_s * 1000;
export const CACHE_MAX = fixture.cache.capacity;

/** The header names one vary row is keyed on, in the fixture's order. */
export const varyOn = (which) => Object.keys(fixture.cache.vary[which]);

// The strings every target answers with. Spelled once so five targets cannot drift on a
// word, which is the kind of difference that reads as a framework result.
export const CACHEABLE = "public, max-age=60";
export const notFoundBody = () => ({ error: "not_found" });
export const forbiddenBody = () => ({ error: "forbidden" });
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

// §4 pins the work these three do. Conformance compares bytes, and a precomputed page
// produces the same bytes as a computed one, so this is the one family where two
// conforming implementations can do wildly different amounts of work.
//
// The page, the size and the status arrive already bound, because binding them is the
// framework's own job and lives in the target.
export function domainFilter(page, size, status) {
  page = Math.max(0, page || 0);
  size = Math.min(100, Math.max(1, size || 25));
  const rows = [];
  for (const o of orders) if (o.status === status) rows.push(o);
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
