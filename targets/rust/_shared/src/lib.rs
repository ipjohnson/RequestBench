//! Behaviour shared by every Rust target. Frameworks differ only in how they bind routes
//! to these functions, so the measured delta is framework overhead.
//!
//! A direct port of `targets/go/_shared/domain.go`. The Node target is what every
//! fingerprint is compared against, so where the languages could differ -- field order in
//! a 422 body, an empty list versus a missing one, the tiebreak in a sort -- this follows
//! Node.

use flate2::{write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::collections::{HashMap, VecDeque};
use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

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

/// The response `json.*`, `compressed.*`, `etag.*`, `cache.*` and `template.*` all serve. It
/// is the controlled variable: three fixed bodies that every feature family reuses, so
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
}

/// What every target sizes its response cache against: the distinct keys the plan sends, a
/// capacity with room above them, an expiry past the end of a run, and the header values
/// the vary rows carry. Derived and asserted in `harness/make_fixture.py` rather than chosen
/// per target, because a store smaller than the key count evicts inside the measured window
/// and the family would report eviction policy instead of the feature.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct CacheDoc {
    pub capacity: usize,
    pub keys: usize,
    pub ttl_s: u64,
    pub vary: HashMap<String, HashMap<String, Vec<String>>>,
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
    cache: CacheDoc,
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
    cache: CacheDoc,
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
        cache: f.cache,
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

/// One field a target's own validator refused. The shape is shared because it is a pair of
/// strings; what goes in it, and the envelope around it, is each target's own.
#[derive(Debug, Clone, Serialize)]
pub struct FieldError {
    pub field: String,
    pub rule: String,
}

impl FieldError {
    pub fn new(field: impl Into<String>, rule: &str) -> Self {
        Self { field: field.into(), rule: rule.to_string() }
    }
}

/// The one failure a handler has to turn into a status. A body a framework's own extractor
/// or validator refused is that framework's answer, raised and rendered where it happens.
#[derive(Debug, Clone)]
pub enum Fail {
    NotFound,
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

/// What [`with_echo`] answers. The payload is borrowed, so no request copies its items.
#[derive(Serialize)]
pub struct WithEcho<E> {
    #[serde(flatten)]
    pub payload: &'static PayloadBody,
    pub echo: E,
}

/// The payload with what a handler bound beside it. A route that binds something answers
/// this, so the value has to be converted and written back rather than bound and dropped.
pub fn with_echo<E: Serialize>(size: &str, echo: E) -> WithEcho<E> {
    WithEcho { payload: payload(size), echo }
}

// ---- the etag and cache families ---------------------------------------------
//
// No ETag value here. Salvo ships a conditional middleware and uses it; the other five
// frameworks ship none, so they compute the validator over the body they are about to send
// with the digest below and declare it in `/__meta`. What is shared is the digest and the
// store, for the same reason `gzip` is: five copies would drift on an algorithm and the
// drift would read as a framework result.

/// The validator, over the exact response bytes: sha1, quoted and strong, which is what
/// Werkzeug and the Node ecosystem both reach for.
pub fn content_etag(body: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(body);
    format!("\"{:x}\"", hasher.finalize())
}

/// What the fixture pins about the response cache every target holds.
pub fn cache_spec() -> &'static CacheDoc {
    &data().cache
}

/// The header names one vary row is keyed on, sorted, so the key a target builds does not
/// depend on a map's iteration order.
pub fn vary_on(which: &str) -> Vec<String> {
    let mut names: Vec<String> = data().cache.vary[which].keys().cloned().collect();
    names.sort();
    names
}

/// One response held in a [`ResponseStore`]: everything needed to write it again.
#[derive(Clone, Debug)]
pub struct StoredResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

/// The response cache a target holds when its framework ships none.
///
/// An LRU with a per-entry expiry, sized from the fixture. Capped rather than unbounded
/// because the point of the capacity is that nothing evicts inside a run, and a cap the key
/// count fits under says that out loud where an unbounded map would only happen to be true.
pub struct ResponseStore {
    inner: Mutex<StoreInner>,
    ttl: Duration,
    capacity: usize,
}

struct StoreInner {
    entries: HashMap<String, (StoredResponse, Instant)>,
    /// Least recently used first, so the front is what a full store drops.
    order: VecDeque<String>,
}

impl ResponseStore {
    pub fn new() -> Self {
        let spec = cache_spec();
        Self {
            inner: Mutex::new(StoreInner {
                entries: HashMap::with_capacity(spec.capacity),
                order: VecDeque::with_capacity(spec.capacity),
            }),
            ttl: Duration::from_secs(spec.ttl_s),
            capacity: spec.capacity,
        }
    }

    pub fn get(&self, key: &str) -> Option<StoredResponse> {
        let mut inner = self.inner.lock().ok()?;
        let expired = match inner.entries.get(key) {
            Some((_, stored_at)) => stored_at.elapsed() > self.ttl,
            None => return None,
        };
        if expired {
            inner.entries.remove(key);
            inner.order.retain(|k| k != key);
            return None;
        }
        inner.order.retain(|k| k != key);
        inner.order.push_back(key.to_string());
        inner.entries.get(key).map(|(v, _)| v.clone())
    }

    pub fn put(&self, key: String, value: StoredResponse) {
        let Ok(mut inner) = self.inner.lock() else { return };
        inner.order.retain(|k| *k != key);
        inner.order.push_back(key.clone());
        inner.entries.insert(key, (value, Instant::now()));
        while inner.order.len() > self.capacity {
            if let Some(oldest) = inner.order.pop_front() {
                inner.entries.remove(&oldest);
            }
        }
    }
}

impl Default for ResponseStore {
    fn default() -> Self {
        Self::new()
    }
}

/// The path plus the value of each header this route is keyed on.
pub fn cache_key(path: &str, values: &[String]) -> String {
    let mut key = String::from(path);
    for v in values {
        key.push('|');
        key.push_str(v);
    }
    key
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
// ---- the order body, after validation ---------------------------------------
// Validating is the framework's own job and lives in each target: every one of the six
// binds with its framework's typed extractor rather than reading raw bytes, and holds its
// own checks for the rules a deserialize cannot express. What is left here is what happens
// once a body is known to be good, which is the same work whichever framework proved it.

/// One order line as it arrived, before pricing.
#[derive(Debug, Clone, Copy)]
pub struct LineInput {
    pub product_id: i64,
    pub qty: i64,
}

/// The work after the validator says yes: look each product up, carry the unit price onto
/// the line, and total it. Identical in every framework, which is why it is here and the
/// validating is not.
pub fn price_order(customer_id: i64, status: &str, in_lines: &[LineInput]) -> ValidatedOrder {
    let d = data();
    let mut lines = Vec::with_capacity(in_lines.len());
    let mut total = 0;
    for (i, l) in in_lines.iter().enumerate() {
        let unit = d.products_by_id.get(&l.product_id).map_or(0, |p| p.price_cents);
        lines.push(Line {
            id: i as i64 + 1,
            product_id: l.product_id,
            qty: l.qty,
            unit_cents: unit,
            total_cents: unit * l.qty,
        });
        total += unit * l.qty;
    }
    ValidatedOrder { id: None, customer_id, status: status.to_string(), lines, total_cents: total }
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

/// The page, the size and the status arrive already bound, because binding them is the
/// framework's own job and lives in the target.
pub fn domain_filter(page: i64, size: i64, status: &str) -> OrdersPage {
    let d = data();
    let page = page.max(0);
    let size = match size {
        0 => 25,
        n => n,
    }
    .clamp(1, 100);
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
