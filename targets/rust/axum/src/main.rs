//! RequestBench target: axum. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses axum's own facility rather than an `if` in the handler, and
//! each one is scoped to its own routes. Compression registered on the router would put a
//! "did the client ask?" check on all forty-five endpoints and contaminate the rows the
//! compressed family is measured against, which is the whole reason those rows have their
//! own paths instead of riding on /json with an accept-encoding header.

use axum::{
    extract::{Path, Query, Request},
    http::{header, HeaderMap, StatusCode},
    middleware::{from_fn, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, MethodRouter},
    Json, Router,
};
use rb_domain as d;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_http::compression::{predicate::SizeAbove, CompressionLayer};

// ---- shared response shapes ---------------------------------------------------

// rb:wiring errors.*,domain.*
/// Maps the domain's failures onto statuses. Handlers return `Result` and never build a
/// 404 or a 422 themselves, so the three targets that share this file cannot drift.
fn fail(e: d::Fail) -> Response {
    match e {
        d::Fail::NotFound => (StatusCode::NOT_FOUND, Json(d::not_found_body())).into_response(),
    }
}

// ---- validation: axum's typed Json extractor, and this target's own rules ------
//
// `Json<OrderIn>` is the framework's binding half: axum deserializes into the struct
// before the handler runs, and rejects a body that will not fit without the handler
// seeing it. The routes used to take `Bytes` and call serde_json::from_slice, which
// made the extractor a no-op and the binding this repository's rather than axum's.
//
// axum draws a line the other frameworks here do not. `JsonRejection` separates
// `JsonSyntaxError`, a body that is not JSON, from `JsonDataError`, a body that is JSON
// but will not deserialize into the type -- and answers 400 for the first and 422 for the
// second. Both are rendered by axum itself, as text, which is why this target is the only
// one answering an error with a body that is not JSON.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because axum has no
// validation layer to put them in.

// rb:wiring body.*,domain.*
/// The order body as axum binds it. `Option` is what makes a missing field a rejection
/// rather than a zero, and serde reports the first field that does not fit.
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

// rb:wiring body.*,domain.*
/// The rules a deserialize cannot state. Every one that fails is reported; `first_error`
/// stops at the first, which is what body.rejected_first asks for and what this target can
/// still answer because the checks are its own.
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

// rb:wiring body.*,errors.*
/// This target's envelope for a body its own checks refused.
fn refused(errs: &[d::FieldError]) -> Value {
    serde_json::json!({ "error": "validation_failed", "errors": errs })
}

// rb:wiring body.*,domain.*
/// The order, or the response this target answers when its own checks refuse the body.
fn validated(order: &OrderIn, first_error: bool) -> Result<d::ValidatedOrder, Response> {
    let errs = check(order, first_error);
    if !errs.is_empty() {
        return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(refused(&errs))).into_response());
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Ok(d::price_order(order.customer_id, &order.status, &lines))
}


// rb:wiring domain.*,errors.*
fn ok<T: serde::Serialize>(v: Result<T, d::Fail>) -> Response {
    match v {
        Ok(v) => Json(v).into_response(),
        Err(e) => fail(e),
    }
}

// rb:wiring body.*,domain.*
/// The request body as a value, or the 422 every target answers when it is not JSON.
/// An unvalidated body, for the endpoints that only parse. Still the extractor's job on
/// the validate routes; this is only for bind, which is measured against them.
fn parse(body: &[u8]) -> Result<Value, Response> {
    serde_json::from_slice(body).map_err(|e| {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "invalid_body", "detail": e.to_string()
        })))
            .into_response()
    })
}

// ---- query: axum's typed Query extractor --------------------------------------
//
// `Query<T>` is the framework's binding half, the same shape as `Json<T>` on the body:
// axum deserializes the query string into the struct before the handler runs and rejects
// what will not fit without the handler seeing it. The struct it fills is what the handler
// echoes beside the small payload, so nothing copies one shape into another.
//
// The fields are plain, so serde decides what a missing or unparseable one is: a
// QueryRejection, which axum renders as its own 400. The endpoint set sends neither.

// rb:wiring query.*
#[derive(Serialize, Deserialize)]
struct QueryOne {
    page: i64,
}

// rb:wiring query.*
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

// rb:wiring domain.*
/// What domain.filter pages by. Not a response shape, so it is deserialize only.
#[derive(Deserialize)]
struct OrderFilter {
    page: i64,
    size: i64,
    status: String,
}

// ---- parameters and headers: axum's Path, and an extractor of its own ---------
//
// `Path<T>` binds the captures the way `Query<T>` binds a query string: axum deserializes
// them into the struct before the handler runs, and the struct it fills is the echo. A
// capture that is not an integer is a PathRejection, which axum renders as its own 400.
//
// axum's own crate has no header binder. TypedHeader moved to axum-extra, which this target
// does not depend on. So the three bound headers are read by an extractor of this target's
// own, through FromRequestParts, the trait every axum extractor implements. It converts the
// account itself, and answers 400 for a header that is missing or will not convert. The
// endpoint set sends neither.

// rb:wiring parameters.*
#[derive(Serialize, Deserialize)]
struct ParamOne {
    one: i64,
}

// rb:wiring parameters.*
#[derive(Serialize, Deserialize)]
struct ParamTwo {
    one: i64,
    two: i64,
}

// rb:wiring headers.*
#[derive(Serialize)]
struct BoundHeaders {
    tenant: String,
    request_id: String,
    account: i64,
}

// rb:wiring headers.*
impl<S: Send + Sync> axum::extract::FromRequestParts<S> for BoundHeaders {
    type Rejection = (StatusCode, Json<Value>);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _: &S,
    ) -> Result<Self, Self::Rejection> {
        let refused = |name: &str| {
            let body = serde_json::json!({ "error": "invalid_header", "detail": name });
            (StatusCode::BAD_REQUEST, Json(body))
        };
        let text = |name: &'static str| {
            parts.headers.get(name).and_then(|v| v.to_str().ok()).ok_or_else(|| refused(name))
        };
        Ok(BoundHeaders {
            tenant: text("x-rb-tenant")?.to_string(),
            request_id: text("x-rb-request-id")?.to_string(),
            account: text("x-rb-account")?.parse().map_err(|_| refused("x-rb-account"))?,
        })
    }
}

// ---- middleware ---------------------------------------------------------------

// rb:wiring authorized.*
/// axum middleware, not a check inside the handler. An `if` in the handler would measure
/// the language; the point of the authorized family is the framework's own plumbing.
async fn require_token(req: Request, next: Next) -> Response {
    let header = req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
    if d::token_ok(header) {
        next.run(req).await
    } else {
        (StatusCode::FORBIDDEN, Json(d::forbidden_body())).into_response()
    }
}

// rb:wiring middleware.*
/// One middleware layer: it calls the next and does nothing else.
async fn noop(req: Request, next: Next) -> Response {
    next.run(req).await
}

// rb:wiring middleware.*
/// `MethodRouter::layer` returns a `MethodRouter`, so the count is a fold rather than
/// sixteen written-out calls.
fn layered(n: usize, h: MethodRouter) -> MethodRouter {
    (0..n).fold(h, |acc, _| acc.layer(from_fn(noop)))
}

// ---- handlers -----------------------------------------------------------------

async fn plaintext() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], "Hello, World!")
}

async fn health() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], "ok")
}

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because a tower layer takes a &'static and the values are the
/// same constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];

async fn meta() -> Json<Value> {
    Json(rb_host::meta("axum", "askama"))
}

// rb:wiring parameters.*,headers.*,middleware.*,authorized.*
async fn small() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

// rb:wiring parameters.*
async fn param_one(Path(p): Path<ParamOne>) -> Json<d::WithEcho<ParamOne>> {
    Json(d::with_echo("small", p))
}

// rb:wiring parameters.*
async fn param_two(Path(p): Path<ParamTwo>) -> Json<d::WithEcho<ParamTwo>> {
    Json(d::with_echo("small", p))
}

// rb:wiring headers.*
async fn bind_headers(h: BoundHeaders) -> Json<d::WithEcho<BoundHeaders>> {
    Json(d::with_echo("small", h))
}

// rb:wiring errors.*
async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(d::not_found_body())).into_response()
}

// rb:wiring json.*
/// The three sizes are static routes, not `/json/{size}`. The size set is fixed, so a
/// capture would make the router pay parameter cost on the family every other target
/// serves from a static route, and it would answer 200 with an empty body for a size that
/// does not exist.
fn payload_route(size: &'static str) -> MethodRouter {
    get(move || async move { Json(d::payload(size)) })
}

// rb:wiring compressed.*
/// Compression is the framework's. The size threshold is left at the library's default:
/// whether a framework bothers to compress a body too small to benefit is what
/// `compressed.gzip_small` is in the set to show, so forcing it would erase the answer.
fn compressed_route(size: &'static str) -> MethodRouter {
    get(move || async move {
        (
            [(header::HeaderName::from_static("x-rb-serial"), d::next_serial())],
            Json(d::payload(size)),
        )
    })
    .layer(
        CompressionLayer::new()
            .gzip(true)
            .quality(tower_http::CompressionLevel::Fastest)
            .compress_when(SizeAbove::new(32)),
    )
}

/// etag: a tower layer on these routes and nowhere else.
///
/// Neither axum nor tower-http computes a validator for a dynamic response, so the digest
/// is the shared one and `/__meta` says so. What is axum's own is the layer and where it is
/// attached: a `Router::layer` on the whole router would hash every response in the blend
/// and contaminate the rows this family is measured against.
///
/// Shallow, which is the point: the handler runs and the body is built before anything is
/// compared, so the 304 saves the write and nothing else.
async fn revalidate(request: Request, next: Next) -> Response {
    let asked = request
        .headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let response = next.run(request).await;
    let (mut parts, body) = response.into_parts();
    let raw = axum::body::to_bytes(body, usize::MAX).await.unwrap_or_default();
    let etag = d::content_etag(&raw);
    parts.headers.insert(header::ETAG, etag.parse().unwrap());
    parts.headers.insert(header::CACHE_CONTROL, d::CACHEABLE.parse().unwrap());
    if asked.as_deref() == Some(etag.as_str()) {
        parts.status = StatusCode::NOT_MODIFIED;
        parts.headers.remove(header::CONTENT_TYPE);
        parts.headers.remove(header::CONTENT_LENGTH);
        return Response::from_parts(parts, axum::body::Body::empty());
    }
    Response::from_parts(parts, axum::body::Body::from(raw))
}

// rb:wiring etag.*
fn etag_route(size: &'static str) -> MethodRouter {
    get(move || async move {
        (
            [(header::HeaderName::from_static("x-rb-serial"), d::next_serial())],
            Json(d::payload(size)),
        )
    })
    .layer(from_fn(revalidate))
}

// rb:wiring cache.*
/// cache: a tower layer that answers from the store before the handler is reached.
///
/// axum ships no response cache, so the store is the shared LRU sized from the fixture.
/// One store for the target rather than one per route, so the capacity the fixture derives
/// from the key count means what it says.
static CACHE: std::sync::LazyLock<d::ResponseStore> =
    std::sync::LazyLock::new(d::ResponseStore::new);

async fn replay(on: &'static [&'static str], request: Request, next: Next) -> Response {
    let values: Vec<String> = on
        .iter()
        .map(|name| {
            request
                .headers()
                .get(*name)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string()
        })
        .collect();
    let key = d::cache_key(request.uri().path(), &values);
    if let Some(hit) = CACHE.get(&key) {
        let mut response = Response::new(axum::body::Body::from(hit.body));
        *response.status_mut() = StatusCode::from_u16(hit.status).unwrap_or(StatusCode::OK);
        for (name, value) in &hit.headers {
            if let (Ok(n), Ok(v)) = (name.parse::<header::HeaderName>(), value.parse()) {
                response.headers_mut().insert(n, v);
            }
        }
        return response;
    }
    let response = next.run(request).await;
    let (parts, body) = response.into_parts();
    let raw = axum::body::to_bytes(body, usize::MAX).await.unwrap_or_default();
    if parts.status == StatusCode::OK {
        CACHE.put(
            key,
            d::StoredResponse {
                status: 200,
                headers: parts
                    .headers
                    .iter()
                    .map(|(n, v)| (n.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect(),
                body: raw.to_vec(),
            },
        );
    }
    Response::from_parts(parts, axum::body::Body::from(raw))
}

// rb:wiring cache.*
fn cache_route(size: &'static str, on: &'static [&'static str]) -> MethodRouter {
    get(move || async move {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::HeaderName::from_static("x-rb-serial"),
            d::next_serial().parse().unwrap(),
        );
        if !on.is_empty() {
            headers.insert(header::VARY, on.join(", ").parse().unwrap());
        }
        (headers, Json(d::payload(size))).into_response()
    })
    .layer(from_fn(move |request, next| replay(on, request, next)))
}

// rb:wiring template.*
fn template_route(size: &'static str) -> MethodRouter {
    get(move || async move {
        (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            items_html(size),
        )
    })
}

// rb:wiring template.*
// ---- template ------------------------------------------------------------------
//
// axum ships no view layer. Askama is what axum's own examples/templates uses.
//
// Askama is a compile-time engine: the template is checked and turned into Rust when the
// binary is built, so this family measures the render and never a parse. The template is
// this target's own, under its own templates/ directory.
#[derive(askama::Template)]
#[template(path = "items.html")]
struct Items {
    body: &'static d::PayloadBody,
}

// rb:wiring template.*
fn items_html(size: &'static str) -> String {
    use askama::Template;
    Items { body: d::payload(size) }.render().unwrap_or_default()
}

// ---- main ---------------------------------------------------------------------

#[cfg(test)]
mod suite;

#[tokio::main]
async fn main() {
    let port = rb_host::boot("axum");

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await.expect("bind");
    let app = app();
    rb_host::listening();
    axum::serve(listener, app).await.expect("serve");
}

/// Every route, on a router nothing is serving yet. Its own function so a test can hand it
/// requests: built inline in main(), the only way to reach it was to start this target on
/// its container port. main() serves what it returns.
fn app() -> Router {
    Router::new()
        .route("/plaintext", get(plaintext))
        .route("/health", get(health))
        .route("/__meta", get(meta))
        .route("/json/small", payload_route("small"))
        .route("/json/medium", payload_route("medium"))
        .route("/json/large", payload_route("large"))
        .route("/parameters/static/segment/literal", get(small))
        .route("/parameters/{one}/segment/literal", get(param_one))
        .route("/parameters/{one}/with-second/{two}", get(param_two))
        .route("/query/one", get(|Query(q): Query<QueryOne>| async move {
            Json(d::with_echo("small", q))
        }))
        .route("/query/many", get(|Query(q): Query<QueryMany>| async move {
            Json(d::with_echo("small", q))
        }))
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 25 nobody asked for.
        .route("/headers", get(small))
        .route("/headers/bind", get(bind_headers))
        .route("/middleware/none", get(small))
        .route("/middleware/four", layered(4, get(small)))
        .route("/middleware/sixteen", layered(16, get(small)))
        .route("/authorized/small", get(small).layer(from_fn(require_token)))
        .route("/compressed/small", compressed_route("small"))
        .route("/compressed/medium", compressed_route("medium"))
        .route("/compressed/large", compressed_route("large"))
        // rb:handler etag.*
        .route("/etag/small", etag_route("small"))
        .route("/etag/large", etag_route("large"))
        // rb:handler cache.small,cache.medium,cache.large
        .route("/cache/small", cache_route("small", &[]))
        .route("/cache/medium", cache_route("medium", &[]))
        .route("/cache/large", cache_route("large", &[]))
        // rb:handler cache.vary_one,cache.vary_many
        .route("/cache/vary/one", cache_route("small", VARY_ONE))
        .route("/cache/vary/many", cache_route("small", VARY_MANY))
        .route("/template/small", template_route("small"))
        .route("/template/medium", template_route("medium"))
        // bind parses and binds without validating, so validate minus bind is the
        // validator alone rather than the validator plus the parse.
        .route("/body/bind/small", post(bind))
        .route("/body/bind/medium", post(bind))
        .route("/body/validate/small", post(validate_all))
        .route("/body/validate/medium", post(validate_all))
        .route("/body/validate/first-error", post(validate_first))
        .route(
            "/domain/orders",
            get(|Query(f): Query<OrderFilter>| async move {
                Json(d::domain_filter(f.page, f.size, &f.status))
            })
            .post(create_order),
        )
        .route("/domain/orders/{oid}", get(lookup_order).put(replace_order))
        .route("/domain/customers/{cid}/summary", get(join))
        .route("/domain/regions/{region}/report", get(aggregate))
        .route("/domain/customers/{cid}", patch(patch_customer))
        .route("/domain/orders/{oid}/lines/{lid}", delete(delete_line))
        // rb:handler errors.unmatched
        .fallback(not_found)
}

// rb:wiring body.*
async fn bind(body: axum::body::Bytes) -> Response {
    match parse(&body) {
        Ok(v) => Json(d::bind_echo(v)).into_response(),
        Err(r) => r,
    }
}

// rb:wiring body.*
async fn validate_all(Json(order): Json<OrderIn>) -> Response {
    match validated(&order, false) {
        Ok(v) => Json(v).into_response(),
        Err(r) => r,
    }
}

// rb:wiring body.*
async fn validate_first(Json(order): Json<OrderIn>) -> Response {
    match validated(&order, true) {
        Ok(v) => Json(v).into_response(),
        Err(r) => r,
    }
}

// rb:wiring domain.*,errors.*
async fn lookup_order(Path(oid): Path<String>) -> Response {
    ok(d::get_order(&oid))
}

// rb:wiring domain.*
async fn join(Path(cid): Path<String>) -> Response {
    ok(d::domain_join(&cid))
}

// rb:wiring domain.*
async fn aggregate(Path(region): Path<String>) -> Response {
    ok(d::domain_aggregate(&region))
}

// rb:wiring domain.*
async fn create_order(Json(order): Json<OrderIn>) -> Response {
    match validated(&order, false) {
        Ok(v) => (
            StatusCode::CREATED,
            [(header::LOCATION, d::created_location())],
            Json(v),
        )
            .into_response(),
        Err(r) => r,
    }
}

// rb:wiring domain.*
async fn replace_order(Path(oid): Path<String>, Json(order): Json<OrderIn>) -> Response {
    let existing = match d::get_order(&oid) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    match validated(&order, false) {
        Ok(mut v) => {
            v.id = Some(existing.id);
            Json(v).into_response()
        }
        Err(r) => r,
    }
}

// rb:wiring domain.*
async fn patch_customer(Path(cid): Path<String>, body: axum::body::Bytes) -> Response {
    let v = match parse(&body) {
        Ok(v) => v,
        Err(r) => return r,
    };
    ok(d::patch_customer(&cid, &v))
}

// rb:wiring domain.*
async fn delete_line(Path((oid, lid)): Path<(String, String)>) -> Response {
    match d::get_order_line(&oid, &lid) {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => fail(e),
    }
}
