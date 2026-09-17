//! RequestBench target: salvo. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses salvo's own facility rather than an `if` in the handler, and
//! each one is hooped onto its own routes. Compression on the root router would put a
//! "did the client ask?" check on all forty-five endpoints and contaminate the rows the
//! compressed family is measured against.

use rb_domain as d;

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because an issuer takes a &'static and the values are the same
/// constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];
use salvo::cache::{Cache, CacheIssuer, MokaStore};
use salvo::compression::{Compression, CompressionLevel};
use salvo::catcher::Catcher;
use salvo::http::{header, StatusCode};
use salvo::prelude::*;
use serde::Serialize;
use serde::Deserialize;
use serde_json::Value;

/// Writes the domain's failures onto the response. Handlers call this and never build a
/// 404 or a 422 themselves.
fn fail(res: &mut Response, e: d::Fail) {
    match e {
        d::Fail::NotFound => {
            res.status_code(StatusCode::NOT_FOUND);
            res.render(Json(d::not_found_body()));
        }
    }
}

// ---- validation: salvo's typed json extractor, and this target's own rules ------
//
// `req.parse_json::<OrderIn>()` is the framework's binding half: salvo deserializes into
// the struct and hands back its own ParseError for a body that will not fit. These routes
// used to take the payload bytes and call serde_json::from_slice, which made the
// extractor a no-op and the binding this repository's rather than salvo's.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because salvo has no
// validation layer to put them in.

/// The order body as salvo binds it. serde reports the first field that does not fit.
#[derive(Debug, Deserialize)]
struct OrderIn {
    customer_id: i64,
    status: String,
    lines: Vec<LineIn>,
}

#[derive(Debug, Deserialize)]
struct LineIn {
    product_id: i64,
    qty: i64,
}

/// The rules a deserialize cannot state. `first_error` stops at the first, which this
/// target can still answer because the checks are its own.
fn check(order: &OrderIn, first_error: bool) -> Vec<d::FieldError> {
    let mut errs: Vec<d::FieldError> = Vec::new();
    if order.lines.is_empty() {
        errs.push(d::FieldError::new("lines", "min_length"));
    }
    for (i, l) in order.lines.iter().enumerate() {
        if first_error && !errs.is_empty() {
            break;
        }
        if l.qty < 1 {
            errs.push(d::FieldError::new(format!("lines[{i}].qty"), "min"));
        }
    }
    errs
}

/// Binds with salvo's extractor and runs this target's own checks, writing whichever
/// refusal applies. `None` means the response has already been written.
async fn bound(req: &mut Request, res: &mut Response, first_error: bool)
    -> Option<d::ValidatedOrder> {
    let order: OrderIn = match req.parse_json().await {
        Ok(o) => o,
        Err(e) => {
            // salvo's own ParseError, and its own status for one.
            res.status_code(StatusCode::BAD_REQUEST);
            res.render(Json(serde_json::json!({
                "error": "invalid_body", "detail": e.to_string()
            })));
            return None;
        }
    };
    let errs = check(&order, first_error);
    if !errs.is_empty() {
        res.status_code(StatusCode::UNPROCESSABLE_ENTITY);
        res.render(Json(serde_json::json!({
            "error": "validation_failed", "errors": errs
        })));
        return None;
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Some(d::price_order(order.customer_id, &order.status, &lines))
}

fn ok<T: Serialize + Send>(res: &mut Response, v: Result<T, d::Fail>) {
    match v {
        Ok(v) => res.render(Json(v)),
        Err(e) => fail(res, e),
    }
}

/// An unvalidated body, for the endpoints that only parse. The validate routes use the
/// extractor; this is only for bind, which is measured against them.
async fn parse(req: &mut Request, res: &mut Response) -> Option<Value> {
    let raw = match req.payload().await {
        Ok(raw) => raw,
        Err(e) => {
            res.status_code(StatusCode::BAD_REQUEST);
            res.render(Json(serde_json::json!({
                "error": "invalid_body", "detail": e.to_string()
            })));
            return None;
        }
    };
    match serde_json::from_slice(raw) {
        Ok(v) => Some(v),
        Err(e) => {
            res.status_code(StatusCode::BAD_REQUEST);
            res.render(Json(serde_json::json!({
                "error": "invalid_body", "detail": e.to_string()
            })));
            None
        }
    }
}

// ---- query: salvo's own query parsing -----------------------------------------
//
// `req.parse_queries::<T>()` is the framework's binding half, the same shape as
// `parse_json` on the body: salvo deserializes the query string into the struct and
// answers its own ParseError for what will not fit. The struct it fills is the struct the
// handler answers.
//
// The fields are plain, so serde decides what a missing or unparseable one is, and the
// status written for it is salvo's own, the same 400 a body that will not parse gets. The
// endpoint set sends neither.

#[derive(Serialize, Deserialize)]
struct QueryOne {
    page: i64,
}

#[derive(Serialize, Deserialize)]
struct QueryMany {
    page: i64,
    size: i64,
    status: String,
    category: String,
    sort: String,
    q: String,
    min_price: i64,
    max_price: i64,
}

/// What domain.filter pages by. Not a response shape, so it is deserialize only.
#[derive(Deserialize)]
struct OrderFilter {
    page: i64,
    size: i64,
    status: String,
}

/// Binds the query with salvo's parser, writing its refusal if there is one.
fn bound_query<T: serde::de::DeserializeOwned>(req: &mut Request, res: &mut Response)
    -> Option<T> {
    match req.parse_queries::<T>() {
        Ok(v) => Some(v),
        Err(e) => {
            res.status_code(StatusCode::BAD_REQUEST);
            res.render(Json(serde_json::json!({
                "error": "invalid_query", "detail": e.to_string()
            })));
            None
        }
    }
}

fn param(req: &mut Request, name: &str) -> String {
    req.param::<String>(name).unwrap_or_default()
}

// ---- handlers -----------------------------------------------------------------

#[handler]
async fn plaintext(res: &mut Response) {
    res.render(Text::Plain("Hello, World!"));
}

#[handler]
async fn health(res: &mut Response) {
    res.render(Text::Plain("ok"));
}

#[handler]
async fn meta(res: &mut Response) {
    res.render(Json(rb_host::meta_with(
        "salvo", "askama", "salvo CachingHeaders", "salvo::cache, MokaStore")));
}

#[handler]
async fn small(res: &mut Response) {
    res.render(Json(d::payload("small")));
}

/// Every route salvo does not match. Registered as the catcher so the body is the same
/// JSON every other target answers rather than salvo's own page.
#[handler]
async fn not_found(res: &mut Response, ctrl: &mut FlowCtrl) {
    if res.status_code.is_none_or(|c| c == StatusCode::NOT_FOUND) {
        res.status_code(StatusCode::NOT_FOUND);
        res.render(Json(d::not_found_body()));
        ctrl.skip_rest();
    }
}

/// salvo middleware, not a check inside the handler. An `if` in the handler would measure
/// the language; the point of the authorized family is the framework's own plumbing.
#[handler]
async fn require_token(req: &mut Request, res: &mut Response, ctrl: &mut FlowCtrl) {
    let header = req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
    if !d::token_ok(header) {
        res.status_code(StatusCode::FORBIDDEN);
        res.render(Json(d::forbidden_body()));
        ctrl.skip_rest();
    }
}

/// One middleware layer: it lets the chain continue and does nothing else.
#[handler]
async fn noop() {}

#[handler]
async fn query_one(req: &mut Request, res: &mut Response) {
    if let Some(q) = bound_query::<QueryOne>(req, res) {
        res.render(Json(q));
    }
}

#[handler]
async fn query_many(req: &mut Request, res: &mut Response) {
    if let Some(q) = bound_query::<QueryMany>(req, res) {
        res.render(Json(q));
    }
}

#[handler]
async fn bind(req: &mut Request, res: &mut Response) {
    if let Some(v) = parse(req, res).await {
        res.render(Json(d::bind_echo(v)));
    }
}

#[handler]
async fn validate_all(req: &mut Request, res: &mut Response) {
    if let Some(v) = bound(req, res, false).await {
        res.render(Json(v));
    }
}

#[handler]
async fn validate_first(req: &mut Request, res: &mut Response) {
    if let Some(v) = bound(req, res, true).await {
        res.render(Json(v));
    }
}

#[handler]
async fn filter(req: &mut Request, res: &mut Response) {
    if let Some(f) = bound_query::<OrderFilter>(req, res) {
        res.render(Json(d::domain_filter(f.page, f.size, &f.status)));
    }
}

#[handler]
async fn lookup(req: &mut Request, res: &mut Response) {
    ok(res, d::get_order(&param(req, "oid")));
}

#[handler]
async fn join(req: &mut Request, res: &mut Response) {
    ok(res, d::domain_join(&param(req, "cid")));
}

#[handler]
async fn aggregate(req: &mut Request, res: &mut Response) {
    ok(res, d::domain_aggregate(&param(req, "region")));
}

#[handler]
async fn create(req: &mut Request, res: &mut Response) {
    if let Some(v) = bound(req, res, false).await {
        res.status_code(StatusCode::CREATED);
        res.add_header(header::LOCATION, d::created_location(), true)
            .ok();
        res.render(Json(v));
    }
}

#[handler]
async fn replace(req: &mut Request, res: &mut Response) {
    let id = match d::get_order(&param(req, "oid")) {
        Ok(o) => o.id,
        Err(e) => return fail(res, e),
    };
    if let Some(mut v) = bound(req, res, false).await {
        v.id = Some(id);
        res.render(Json(v));
    }
}

#[handler]
async fn patch_customer(req: &mut Request, res: &mut Response) {
    let cid = param(req, "cid");
    let Some(body) = parse(req, res).await else { return };
    ok(res, d::patch_customer(&cid, &body));
}

#[handler]
async fn delete_line(req: &mut Request, res: &mut Response) {
    match d::get_order_line(&param(req, "oid"), &param(req, "lid")) {
        Ok(_) => {
            res.status_code(StatusCode::NO_CONTENT);
        }
        Err(e) => fail(res, e),
    }
}

// ---- routes -------------------------------------------------------------------

macro_rules! payload_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.render(Json(d::payload($size)));
        }
    };
}
payload_handler!(json_small, "small");
payload_handler!(json_medium, "medium");
payload_handler!(json_large, "large");

macro_rules! compressed_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.add_header("x-rb-serial", d::next_serial(), true).ok();
            res.render(Json(d::payload($size)));
        }
    };
}
compressed_handler!(comp_small, "small");
compressed_handler!(comp_medium, "medium");
compressed_handler!(comp_large, "large");

/// etag: salvo's own CachingHeaders middleware.
///
/// It hashes the body the handler rendered, writes the validator, and answers If-None-Match
/// with a 304 itself, so nothing here compares anything. Salvo is the one Rust target that
/// has this: the other five hold a digest of their own and say so in `/__meta`.
///
/// Hooped onto the router for these two routes rather than the service, because a digest
/// over every response in the blend would contaminate the rows this family is measured
/// against.
macro_rules! etag_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.add_header(header::CACHE_CONTROL, d::CACHEABLE, true).ok();
            res.add_header("x-rb-serial", d::next_serial(), true).ok();
            res.render(Json(d::payload($size)));
        }
    };
}
etag_handler!(etag_small, "small");
etag_handler!(etag_large, "large");

/// cache: salvo's own Cache middleware over the shared store.
///
/// The middleware stores the status, the headers and the body and replays them before the
/// handler is reached, which is why x-rb-serial repeats across a run. What it takes from
/// this target is where the key comes from: a CacheIssuer is salvo's own extension point
/// for that, and the vary rows fold their header values in through it.
///
/// One store for the target, sized from the fixture, so the capacity derived from the key
/// count means what it says.
struct KeyedBy(&'static [&'static str]);

impl CacheIssuer for KeyedBy {
    type Key = String;

    async fn issue(&self, req: &mut Request, _depot: &Depot) -> Option<Self::Key> {
        let values: Vec<String> = self
            .0
            .iter()
            .map(|name| {
                req.headers().get(*name).and_then(|v| v.to_str().ok()).unwrap_or("").to_string()
            })
            .collect();
        Some(d::cache_key(req.uri().path(), &values))
    }
}

fn response_cache(on: &'static [&'static str]) -> Cache<MokaStore<String>, KeyedBy> {
    let spec = d::cache_spec();
    Cache::new(
        MokaStore::builder()
            .max_capacity(spec.capacity as u64)
            .time_to_live(std::time::Duration::from_secs(spec.ttl_s))
            .build(),
        KeyedBy(on),
    )
}

macro_rules! cache_handler {
    ($name:ident, $size:literal, $vary:expr) => {
        #[handler]
        async fn $name(res: &mut Response) {
            let on: &[&str] = $vary;
            if !on.is_empty() {
                res.add_header(header::VARY, on.join(", "), true).ok();
            }
            res.add_header("x-rb-serial", d::next_serial(), true).ok();
            res.render(Json(d::payload($size)));
        }
    };
}
cache_handler!(cache_small, "small", &[]);
cache_handler!(cache_medium, "medium", &[]);
cache_handler!(cache_large, "large", &[]);
cache_handler!(cache_vary_one, "small", VARY_ONE);
cache_handler!(cache_vary_many, "small", VARY_MANY);

macro_rules! template_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.render(Text::Html(items_html($size)));
        }
    };
}
template_handler!(tpl_small, "small");
template_handler!(tpl_medium, "medium");

// ---- template ------------------------------------------------------------------
//
// salvo ships no view layer and recommends no engine. Askama is the compile-time
// engine axum's own examples reach for, and it is what every Rust target without a view
// layer renders with here.
//
// Askama is a compile-time engine: the template is checked and turned into Rust when the
// binary is built, so this family measures the render and never a parse. The template is
// this target's own, under its own templates/ directory.
#[derive(askama::Template)]
#[template(path = "items.html")]
struct Items {
    body: &'static d::PayloadBody,
}

fn items_html(size: &'static str) -> String {
    use askama::Template;
    Items { body: d::payload(size) }.render().unwrap_or_default()
}

#[tokio::main]
async fn main() {
    let port = rb_host::boot("salvo");

    // Level pinned across every language; the default size threshold is left alone,
    // because whether a framework bothers to compress a body too small to benefit is what
    // compressed.gzip_small is in the set to show.
    let compression = Compression::new().enable_gzip(CompressionLevel::Precise(d::GZIP_LEVEL as u32));

    let mut four = Router::with_path("/middleware/four");
    for _ in 0..4 {
        four = four.hoop(noop);
    }
    let mut sixteen = Router::with_path("/middleware/sixteen");
    for _ in 0..16 {
        sixteen = sixteen.hoop(noop);
    }

    let router = Router::new()
        .push(Router::with_path("/plaintext").get(plaintext))
        .push(Router::with_path("/health").get(health))
        .push(Router::with_path("/__meta").get(meta))
        .push(Router::with_path("/json/small").get(json_small))
        .push(Router::with_path("/json/medium").get(json_medium))
        .push(Router::with_path("/json/large").get(json_large))
        .push(Router::with_path("/parameters/static/segment/literal").get(small))
        .push(Router::with_path("/parameters/{one}/with-second/{two}").get(small))
        .push(Router::with_path("/parameters/{one}").get(small))
        .push(Router::with_path("/query/one").get(query_one))
        .push(Router::with_path("/query/many").get(query_many))
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 27 nobody asked for.
        .push(Router::with_path("/headers").get(small))
        .push(Router::with_path("/middleware/none").get(small))
        .push(four.get(small))
        .push(sixteen.get(small))
        .push(Router::with_path("/authorized/small").hoop(require_token).get(small))
        // rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
        // rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
        .push(
            Router::with_path("/compressed")
                .hoop(compression)
                .push(Router::with_path("/small").get(comp_small))
                .push(Router::with_path("/medium").get(comp_medium))
                .push(Router::with_path("/large").get(comp_large)),
        )
        // rb:snippet etag.small etag.large etag.match_large etag.stale_large
        .push(Router::with_path("/etag/small").hoop(CachingHeaders::new()).get(etag_small))
        .push(Router::with_path("/etag/large").hoop(CachingHeaders::new()).get(etag_large))
        // rb:snippet cache.small cache.medium cache.large
        .push(Router::with_path("/cache/small").hoop(response_cache(&[])).get(cache_small))
        .push(Router::with_path("/cache/medium").hoop(response_cache(&[])).get(cache_medium))
        .push(Router::with_path("/cache/large").hoop(response_cache(&[])).get(cache_large))
        // rb:snippet cache.vary_one cache.vary_many
        .push(
            Router::with_path("/cache/vary/one")
                .hoop(response_cache(VARY_ONE))
                .get(cache_vary_one),
        )
        .push(
            Router::with_path("/cache/vary/many")
                .hoop(response_cache(VARY_MANY))
                .get(cache_vary_many),
        )
        .push(Router::with_path("/template/small").get(tpl_small))
        .push(Router::with_path("/template/medium").get(tpl_medium))
        // bind parses and binds without validating, so validate minus bind is the
        // validator alone rather than the validator plus the parse.
        .push(Router::with_path("/body/bind/small").post(bind))
        .push(Router::with_path("/body/bind/medium").post(bind))
        .push(Router::with_path("/body/validate/first-error").post(validate_first))
        .push(Router::with_path("/body/validate/small").post(validate_all))
        .push(Router::with_path("/body/validate/medium").post(validate_all))
        .push(Router::with_path("/domain/orders").get(filter).post(create))
        .push(Router::with_path("/domain/orders/{oid}").get(lookup).put(replace))
        .push(Router::with_path("/domain/orders/{oid}/lines/{lid}").delete(delete_line))
        .push(Router::with_path("/domain/customers/{cid}/summary").get(join))
        .push(Router::with_path("/domain/customers/{cid}").patch(patch_customer))
        .push(Router::with_path("/domain/regions/{region}/report").get(aggregate));

    // rb:snippet errors.unmatched
    let service = Service::new(router).catcher(Catcher::default().hoop(not_found));
    let acceptor = TcpListener::new(("0.0.0.0", port)).bind().await;
    Server::new(acceptor).serve(service).await;
}
