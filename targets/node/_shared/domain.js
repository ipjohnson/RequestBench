// Domain logic shared by every Node target. Frameworks differ only in how they wire
// routes to these functions, so the measured delta is framework overhead and nothing else.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "../../../spec/fixture.json"), "utf8"));

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

export function validateOrder(body) {
  const errs = [];
  req(errs, body, "customer_id", "int");
  req(errs, body, "status", "string");
  req(errs, body, "lines", "array");
  if (Array.isArray(body?.lines)) {
    if (body.lines.length === 0) errs.push({ field: "lines", rule: "min_length" });
    body.lines.forEach((l, i) => {
      if (!Number.isInteger(l?.product_id)) errs.push({ field: `lines[${i}].product_id`, rule: "int" });
      if (!Number.isInteger(l?.qty) || l.qty < 1) errs.push({ field: `lines[${i}].qty`, rule: "min" });
    });
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
