//! Behaviour shared by every Rust target. Frameworks differ only in how they bind routes
//! to these functions, so the measured delta is framework overhead.
//!
//! A direct port of `targets/go/_shared/domain.go`. The Node target is what every
//! fingerprint is compared against, so where the languages could differ -- field order in
//! a 422 body, an empty list versus a missing one, the tiebreak in a sort -- this follows
//! Node.

use flate2::{write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

// ---- fixture ----------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub price_cents: i64,
    pub in_stock: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub region: String,
    pub created: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Line {
    pub id: i64,
    pub product_id: i64,
    pub qty: i64,
    pub unit_cents: i64,
    pub total_cents: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
    pub customer_id: i64,
    pub status: String,
    pub created: String,
    pub total_cents: i64,
    pub lines: Vec<Line>,
}

/// The response `json.*`, `compressed.*`, `cached.*` and `template.*` all serve. It is the
/// controlled variable: three fixed bodies that every feature family reuses unchanged, so
/// subtracting a base endpoint from its arm leaves the feature and nothing else.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PayloadBody {
    pub count: i64,
    pub items: Vec<Product>,
    pub size: String,
}

#[derive(Clone, Debug, Deserialize)]
struct PayloadDoc {
    body: PayloadBody,
    etag: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
struct AuthDoc {
    token: String,
}

#[derive(Deserialize)]
struct Fixture {
    products: Vec<Product>,
    customers: Vec<Customer>,
    orders: Vec<Order>,
    payloads: HashMap<String, PayloadDoc>,
    auth: AuthDoc,
}

pub struct Data {
    pub orders: Vec<Order>,
    pub customers: Vec<Customer>,
    /// The id a created order would get. The fixture holds 1..1000, so it is 1001:
    /// synthetic and deterministic, which is all a Location header needs when nothing is
    /// persisted.
    pub next_order_id: i64,
    products_by_id: HashMap<i64, Product>,
    customers_by_id: HashMap<i64, usize>,
    orders_by_id: HashMap<i64, usize>,
    payloads: HashMap<String, PayloadDoc>,
    auth: AuthDoc,
}

static DATA: OnceLock<Data> = OnceLock::new();
static SERIAL: AtomicU64 = AtomicU64::new(0);

/// Read the fixture once. Every target calls this before it binds a port.
pub fn load(path: &str) -> Result<(), String> {
    let raw = std::fs::read(path).map_err(|e| format!("{path}: {e}"))?;
    let f: Fixture = serde_json::from_slice(&raw).map_err(|e| format!("{path}: {e}"))?;

    let products_by_id = f.products.iter().map(|p| (p.id, p.clone())).collect();
    let customers_by_id = f.customers.iter().enumerate().map(|(i, c)| (c.id, i)).collect();
    let orders_by_id = f.orders.iter().enumerate().map(|(i, o)| (o.id, i)).collect();
    let next_order_id = f.orders.len() as i64 + 1;

    DATA.set(Data {
        orders: f.orders,
        customers: f.customers,
        next_order_id,
        products_by_id,
        customers_by_id,
        orders_by_id,
        payloads: f.payloads,
        auth: f.auth,
    })
    .map_err(|_| "fixture loaded twice".to_string())
}

pub fn data() -> &'static Data {
    DATA.get().expect("rb_domain::load was not called")
}

/// The path the fixture is read from, honouring the same variable every language uses.
pub fn fixture_path() -> String {
    std::env::var("RB_FIXTURE").unwrap_or_else(|_| "../../spec/fixture.json".to_string())
}

// ---- errors -----------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct FieldError {
    pub field: String,
    pub rule: String,
}

impl FieldError {
    fn new(field: impl Into<String>, rule: &str) -> Self {
        Self { field: field.into(), rule: rule.to_string() }
    }
}

/// Every failure a handler has to turn into a status. `NotFound` is the sentinel every
/// lookup returns; `Invalid` carries the 422 body.
#[derive(Debug, Clone)]
pub enum Fail {
    NotFound,
    Invalid(Vec<FieldError>),
}

/// The 422 body, as every target sends it.
pub fn invalid_body(errors: &[FieldError]) -> Value {
    serde_json::json!({ "error": "validation_failed", "errors": errors })
}

pub fn not_found_body() -> Value {
    serde_json::json!({ "error": "not_found" })
}

pub fn forbidden_body() -> Value {
    serde_json::json!({ "error": "forbidden" })
}

// ---- blend-v2 responses ------------------------------------------------------

/// Not pre-serialized. `json.small` against `json.large` is one fixture read, one
/// serialize and one write at three sizes; handing back a cached string would measure none
/// of it.
pub fn payload(size: &str) -> &'static PayloadBody {
    &data().payloads[size].body
}

/// Pinned in the fixture, so what a target spends is emitting the header and comparing it
/// rather than hashing a body.
pub fn etag_of(size: &str) -> &'static str {
    &data().payloads[size].etag
}

/// Pinned across every language. Compression cost is dominated by codec and level, not by
/// framework, so an unpinned level makes `compressed.*` a zlib benchmark.
pub const GZIP_LEVEL: u32 = 6;

/// Compresses at the pinned level. Targets whose framework brings its own middleware use
/// that instead and configure it to this level.
pub fn gzip(bytes: &[u8]) -> Vec<u8> {
    let mut w = GzEncoder::new(Vec::new(), Compression::new(GZIP_LEVEL));
    let _ = w.write_all(bytes);
    w.finish().unwrap_or_default()
}

/// `x-rb-serial`, monotonic per process. A response served from a cache anywhere in the
/// path, or precomputed at boot, repeats a number it did not increment, and identical
/// bytes are the whole point of the fingerprint.
pub fn next_serial() -> String {
    (SERIAL.fetch_add(1, Ordering::Relaxed) + 1).to_string()
}

/// The denial arm's token differs only in its last character, so this compares the whole
/// string rather than failing on length.
pub fn token_ok(header: Option<&str>) -> bool {
    match header {
        Some(h) => h.strip_prefix("Bearer ").is_some_and(|t| t == data().auth.token),
        None => false,
    }
}

pub const CACHEABLE: &str = "public, max-age=60";

/// The Location a created order points at. Built by concatenation rather than a format
/// string: `"/domain/orders/{}"` is indistinguishable from a route with a capture, and
/// harness/snippets.py then finds the domain routes in two places and refuses to guess.
pub fn created_location() -> String {
    let mut s = String::from("/domain/orders/");
    s.push_str(&data().next_order_id.to_string());
    s
}

// ---- query families ----------------------------------------------------------
//
// The query arms have to echo the coerced values or the parse can be skipped and the
// endpoint measures nothing.

/// Query string parsed into first-value-wins pairs, which is what every other language's
/// `map[string][]string` lookup does with `[0]`.
pub type Query = Vec<(String, String)>;

fn qstr(q: &Query, k: &str) -> String {
    q.iter().find(|(n, _)| n == k).map(|(_, v)| v.clone()).unwrap_or_default()
}

fn qint(q: &Query, k: &str) -> i64 {
    q.iter()
        .find(|(n, _)| n == k)
        .and_then(|(_, v)| v.parse::<i64>().ok())
        .unwrap_or(0)
}

/// Split a raw query string. Percent-decoding is left to the framework where it offers it;
/// the spec's query values are plain and every target sees the same bytes.
pub fn parse_query(raw: &str) -> Query {
    raw.split('&')
        .filter(|p| !p.is_empty())
        .map(|p| match p.split_once('=') {
            Some((k, v)) => (k.to_string(), v.to_string()),
            None => (p.to_string(), String::new()),
        })
        .collect()
}

#[derive(Serialize)]
pub struct QueryOne {
    pub page: i64,
}

#[derive(Serialize)]
pub struct QueryMany {
    pub page: i64,
    pub size: i64,
    pub status: String,
    pub category: String,
    pub sort: String,
    pub q: String,
    pub min_price: i64,
    pub max_price: i64,
}

pub fn coerce_one(q: &Query) -> QueryOne {
    QueryOne { page: qint(q, "page") }
}

pub fn coerce_many(q: &Query) -> QueryMany {
    QueryMany {
        page: qint(q, "page"),
        size: qint(q, "size"),
        status: qstr(q, "status"),
        category: qstr(q, "category"),
        sort: qstr(q, "sort"),
        q: qstr(q, "q"),
        min_price: qint(q, "min_price"),
        max_price: qint(q, "max_price"),
    }
}

// ---- body --------------------------------------------------------------------

#[derive(Serialize)]
pub struct BindResult {
    pub fields: i64,
    pub bytes: i64,
    pub echo: Value,
}

/// Walks the parsed body. Without a field derived from the parsed structure a target can
/// pipe request bytes straight to the response and never parse.
fn leaf_count(v: &Value) -> i64 {
    match v {
        Value::Object(m) => m.values().map(leaf_count).sum(),
        Value::Array(a) => a.iter().map(leaf_count).sum(),
        _ => 1,
    }
}

pub fn bind_echo(body: Value) -> BindResult {
    let bytes = serde_json::to_vec(&body).map(|b| b.len()).unwrap_or(0) as i64;
    BindResult { fields: leaf_count(&body), bytes, echo: body }
}

// ---- validation --------------------------------------------------------------
//
// Error field order matches the Node reference exactly; conform.py fingerprints the 422
// bodies, so a reordered check here shows up as a conformance failure.

#[derive(Serialize)]
pub struct ValidatedOrder {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub customer_id: i64,
    pub status: String,
    pub lines: Vec<Line>,
    pub total_cents: i64,
}

/// Integral in the way Go's `f == float64(int64(f))` is: a JSON number with nothing after
/// the point. `true` and `"3"` are not numbers and do not pass.
fn is_int(v: Option<&Value>) -> bool {
    match v {
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f == (f as i64) as f64),
        _ => false,
    }
}

fn req_field(errs: &mut Vec<FieldError>, m: &Map<String, Value>, field: &str, typ: &str) {
    match m.get(field) {
        None | Some(Value::Null) => errs.push(FieldError::new(field, "required")),
        Some(v) => match typ {
            "int" if !is_int(Some(v)) => errs.push(FieldError::new(field, "int")),
            "string" if !v.is_string() => errs.push(FieldError::new(field, "string")),
            "array" if !v.is_array() => errs.push(FieldError::new(field, "array")),
            _ => {}
        },
    }
}

/// `validate_order` reports every problem it finds; `first_error` stops at the first,
/// which is what `body.rejected_all` minus `body.rejected_first` states as a number: the
/// same walk in the same order, differing only in where it gives up.
pub fn validate_order(body: &Value, first_error: bool) -> Result<ValidatedOrder, Fail> {
    let empty = Map::new();
    let m = body.as_object().unwrap_or(&empty);
    let mut errs: Vec<FieldError> = Vec::new();
    macro_rules! bail {
        () => {
            first_error && !errs.is_empty()
        };
    }

    req_field(&mut errs, m, "customer_id", "int");
    if !bail!() {
        req_field(&mut errs, m, "status", "string");
    }
    if !bail!() {
        req_field(&mut errs, m, "lines", "array");
    }

    let raw = m.get("lines").and_then(Value::as_array);
    if let Some(rows) = raw {
        if !bail!() {
            if rows.is_empty() {
                errs.push(FieldError::new("lines", "min_length"));
            }
            for (i, e) in rows.iter().enumerate() {
                if bail!() {
                    break;
                }
                let l = e.as_object();
                let get = |k: &str| l.and_then(|o| o.get(k));
                if !is_int(get("product_id")) {
                    errs.push(FieldError::new(format!("lines[{i}].product_id"), "int"));
                }
                let qty = get("qty").and_then(Value::as_f64);
                if !bail!() && !qty.is_some_and(|q| is_int(get("qty")) && q >= 1.0) {
                    errs.push(FieldError::new(format!("lines[{i}].qty"), "min"));
                }
            }
        }
    }
    if !errs.is_empty() {
        return Err(Fail::Invalid(errs));
    }

    let rows = raw.map(Vec::as_slice).unwrap_or(&[]);
    let d = data();
    let mut lines = Vec::with_capacity(rows.len());
    let mut total = 0;
    for (i, e) in rows.iter().enumerate() {
        let o = e.as_object().expect("validated above");
        let pid = o["product_id"].as_f64().expect("validated above") as i64;
        let qty = o["qty"].as_f64().expect("validated above") as i64;
        let unit = d.products_by_id.get(&pid).map_or(0, |p| p.price_cents);
        lines.push(Line { id: i as i64 + 1, product_id: pid, qty, unit_cents: unit, total_cents: unit * qty });
        total += unit * qty;
    }
    Ok(ValidatedOrder {
        id: None,
        customer_id: m["customer_id"].as_f64().expect("validated above") as i64,
        status: m["status"].as_str().expect("validated above").to_string(),
        lines,
        total_cents: total,
    })
}

/// The 422 every target answers when the request body is not JSON at all. It is a value
/// rather than a parse error so `errors.malformed` and `body.rejected_*` share a shape.
pub fn malformed_body() -> Fail {
    Fail::Invalid(vec![FieldError::new("body", "json")])
}

pub fn patch_customer(cid: &str, body: &Value) -> Result<Customer, Fail> {
    let d = data();
    let id: i64 = cid.parse().map_err(|_| Fail::NotFound)?;
    let idx = *d.customers_by_id.get(&id).ok_or(Fail::NotFound)?;
    let mut out = d.customers[idx].clone();
    if let Some(n) = body.get("name").and_then(Value::as_str).filter(|s| !s.is_empty()) {
        out.name = n.to_string();
    }
    if let Some(r) = body.get("region").and_then(Value::as_str).filter(|s| !s.is_empty()) {
        out.region = r.to_string();
    }
    Ok(out)
}

// ---- domain -------------------------------------------------------------------
//
// `domain_filter`, `domain_join` and `domain_aggregate` do the work the spec pins.
// Conformance compares values, and a precomputed page produces the same value as a
// computed one, so this is the one family where two conforming implementations can do
// wildly different amounts of work. The predicate runs over the live list on every
// request, the join walks the lines, and the aggregate folds every matching order. No
// index, no memoization.

/// Borrowed, not cloned. The fixture outlives every request, and copying 25 orders per
/// call would be work no other language's target does.
#[derive(Serialize)]
pub struct OrdersPage {
    pub page: i64,
    pub size: i64,
    pub total: i64,
    pub items: Vec<&'static Order>,
}

#[derive(Serialize)]
pub struct RecentOrder {
    pub id: i64,
    pub created: String,
    pub total_cents: i64,
}

#[derive(Serialize)]
pub struct JoinSummary {
    pub customer: &'static Customer,
    pub order_count: i64,
    pub lifetime_cents: i64,
    pub line_count: i64,
    pub units: i64,
    pub recent: Vec<RecentOrder>,
}

#[derive(Serialize)]
pub struct TopOrder {
    pub id: i64,
    pub total_cents: i64,
}

#[derive(Serialize)]
pub struct Report {
    pub region: String,
    pub customers: i64,
    pub orders: i64,
    pub revenue_cents: i64,
    pub top: Vec<TopOrder>,
}

pub fn get_order(id: &str) -> Result<&'static Order, Fail> {
    let d = data();
    let n: i64 = id.parse().map_err(|_| Fail::NotFound)?;
    d.orders_by_id.get(&n).map(|i| &d.orders[*i]).ok_or(Fail::NotFound)
}

pub fn get_order_line(oid: &str, lid: &str) -> Result<&'static Line, Fail> {
    let o = get_order(oid)?;
    let n: i64 = lid.parse().map_err(|_| Fail::NotFound)?;
    o.lines.iter().find(|l| l.id == n).ok_or(Fail::NotFound)
}

pub fn domain_filter(q: &Query) -> OrdersPage {
    let d = data();
    let page = qint(q, "page").max(0);
    let size = match qint(q, "size") {
        0 => 25,
        n => n,
    }
    .clamp(1, 100);
    let status = qstr(q, "status");
    let rows: Vec<&'static Order> = d.orders.iter().filter(|o| o.status == status).collect();
    let start = ((page * size) as usize).min(rows.len());
    let end = (start + size as usize).min(rows.len());
    OrdersPage { page, size, total: rows.len() as i64, items: rows[start..end].to_vec() }
}

pub fn domain_join(cid: &str) -> Result<JoinSummary, Fail> {
    let d = data();
    let id: i64 = cid.parse().map_err(|_| Fail::NotFound)?;
    let idx = *d.customers_by_id.get(&id).ok_or(Fail::NotFound)?;
    let customer = &d.customers[idx];

    let mut out = JoinSummary {
        customer,
        order_count: 0,
        lifetime_cents: 0,
        line_count: 0,
        units: 0,
        recent: Vec::new(),
    };
    for o in d.orders.iter().filter(|o| o.customer_id == customer.id) {
        out.order_count += 1;
        out.lifetime_cents += o.total_cents;
        for l in &o.lines {
            out.line_count += 1;
            out.units += l.qty;
        }
        out.recent.push(RecentOrder { id: o.id, created: o.created.clone(), total_cents: o.total_cents });
    }
    if out.recent.len() > 5 {
        out.recent.drain(..out.recent.len() - 5);
    }
    Ok(out)
}

pub fn domain_aggregate(region: &str) -> Result<Report, Fail> {
    let d = data();
    let in_region: std::collections::HashSet<i64> =
        d.customers.iter().filter(|c| c.region == region).map(|c| c.id).collect();
    if in_region.is_empty() {
        return Err(Fail::NotFound);
    }
    let mut r = Report {
        region: region.to_string(),
        customers: in_region.len() as i64,
        orders: 0,
        revenue_cents: 0,
        top: Vec::new(),
    };
    let mut matched: Vec<&Order> = Vec::new();
    for o in d.orders.iter().filter(|o| in_region.contains(&o.customer_id)) {
        r.orders += 1;
        r.revenue_cents += o.total_cents;
        matched.push(o);
    }
    // Highest first, ties broken by the lower id, and stable so equal keys keep fixture
    // order. Go sorts the same way; a different tiebreak is a conformance failure rather
    // than a preference.
    matched.sort_by(|a, b| b.total_cents.cmp(&a.total_cents).then(a.id.cmp(&b.id)));
    r.top = matched.iter().take(10).map(|o| TopOrder { id: o.id, total_cents: o.total_cents }).collect();
    Ok(r)
}
