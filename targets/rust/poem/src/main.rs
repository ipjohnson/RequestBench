//! RequestBench target: poem. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses poem's own facility rather than an `if` in the handler, and
//! each one is scoped to its own routes. Compression applied to the whole app would put a
//! "did the client ask?" check on all forty-five endpoints and contaminate the rows the
//! compressed family is measured against.

use poem::{
    error::ResponseError,
    get,
    http::{header, StatusCode},
    listener::TcpListener,
    middleware::Compression,
    post,
    web::{Json, Path, Query},
    endpoint::make,
    Body, Endpoint, EndpointExt, IntoResponse, Request, Response, Route, Server,
};
use rb_domain as d;

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because the closures below take a &'static and the values are
/// the same constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];

// rb:wiring cache.*
/// One store for the target, sized from the fixture.
static CACHE: std::sync::LazyLock<d::ResponseStore> =
    std::sync::LazyLock::new(d::ResponseStore::new);
use serde::{Deserialize, Serialize};
use serde_json::Value;

// rb:wiring errors.*,domain.*
/// The domain's failures as poem errors, so a handler returns `Result` and never builds a
/// 404 or a 422 itself.
#[derive(Debug)]
struct Failed(d::Fail);

impl std::fmt::Display for Failed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("failed")
    }
}
impl std::error::Error for Failed {}

impl ResponseError for Failed {
    fn status(&self) -> StatusCode {
        match self.0 {
            d::Fail::NotFound => StatusCode::NOT_FOUND,
        }
    }
    fn as_response(&self) -> Response {
        let body = match &self.0 {
            d::Fail::NotFound => d::not_found_body(),
        };
        Json(body).with_status(self.status()).into_response()
    }
}

impl From<d::Fail> for Failed {
    fn from(f: d::Fail) -> Self {
        Failed(f)
    }
}

type R<T> = Result<T, Failed>;

// rb:wiring errors.*,body.*
/// An answer this target decided on itself, carried back through poem's error channel so
/// the framework renders the status and body this target chose rather than one of its own.
#[derive(Debug)]
struct Rejected(StatusCode, Value);

impl std::fmt::Display for Rejected {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "rejected")
    }
}
impl std::error::Error for Rejected {}

impl ResponseError for Rejected {
    fn status(&self) -> StatusCode {
        self.0
    }
    fn as_response(&self) -> Response {
        Json(self.1.clone()).with_status(self.0).into_response()
    }
}

/// An unvalidated body, for the endpoints that only parse. The validate routes use the
/// extractor; this is only for bind, which is measured against them.
/// The one domain failure, as this target's rejection carrier.
fn not_found_rejection(_: d::Fail) -> Rejected {
    Rejected(StatusCode::NOT_FOUND, d::not_found_body())
}

// rb:wiring body.*,domain.*
fn parse(body: &[u8]) -> Result<Value, Rejected> {
    serde_json::from_slice(body).map_err(|e: serde_json::Error| {
        Rejected(
            StatusCode::BAD_REQUEST,
            serde_json::json!({ "error": "invalid_body", "detail": e.to_string() }),
        )
    })
}

// ---- validation: poem's typed Json extractor, and this target's own rules ------
//
// `Json<OrderIn>` is the framework's binding half: poem deserializes into the struct
// before the handler runs and rejects a body that will not fit without the handler seeing
// it. These routes used to take `Vec<u8>` and call serde_json::from_slice, which made the
// extractor a no-op and the binding this repository's rather than poem's.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because poem has no
// validation layer to put them in.

// rb:wiring body.*,domain.*
/// The order body as poem binds it. serde reports the first field that does not fit.
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

// rb:wiring body.*,domain.*
/// The order, or this target's own answer when its own checks refuse the body.
fn validated(order: &OrderIn, first_error: bool) -> Result<d::ValidatedOrder, Rejected> {
    let errs = check(order, first_error);
    if !errs.is_empty() {
        return Err(Rejected(
            StatusCode::UNPROCESSABLE_ENTITY,
            serde_json::json!({ "error": "validation_failed", "errors": errs }),
        ));
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Ok(d::price_order(order.customer_id, &order.status, &lines))
}

// ---- query: poem's typed Query extractor --------------------------------------
//
// `Query<T>` is the framework's binding half, the same shape as `Json<T>` on the body:
// poem deserializes the query string into the struct before the handler runs and rejects
// what will not fit without the handler seeing it. The struct it fills is the struct the
// handler answers.
//
// The fields are plain, so serde decides what a missing or unparseable one is: a
// ParseQueryError, which poem renders as its own 400. The endpoint set sends neither.

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

// rb:wiring errors.*
/// Every route poem does not match. Its own 404 carries no body, and every other target
/// answers the same JSON, so the shape is supplied rather than left to the framework.
async fn not_found() -> Response {
    Json(d::not_found_body()).with_status(StatusCode::NOT_FOUND).into_response()
}

// rb:wiring middleware.*
/// Boxed so the count is a fold rather than sixteen written-out calls. Each layer is a
/// real poem middleware that calls the next and does nothing else.
fn layered(n: usize, ep: poem::endpoint::BoxEndpoint<'static>) -> poem::endpoint::BoxEndpoint<'static> {
    (0..n).fold(ep, |acc, _| acc.around(|ep, req| async move { ep.call(req).await }).boxed())
}

// rb:wiring template.*
// ---- template ------------------------------------------------------------------
//
// poem ships no view layer and recommends no engine. Askama is the compile-time
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

// rb:wiring template.*
fn items_html(size: &'static str) -> String {
    use askama::Template;
    Items { body: d::payload(size) }.render().unwrap_or_default()
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    let port = rb_host::boot("poem");

    // rb:wiring parameters.*,headers.*,middleware.*,authorized.*
    let small = || get(make(|_| async { Json(d::payload("small")) }));

    // rb:wiring json.*
    let payload_route =
        |size: &'static str| get(make(move |_| async move { Json(d::payload(size)) }));

    // rb:wiring compressed.*
    // Level pinned across every language; the default size threshold is left alone,
    // because whether a framework bothers to compress a body too small to benefit is what
    // compressed.gzip_small is in the set to show.
    let compressed_route = |size: &'static str| {
        get(make(move |_| async move {
            Json(d::payload(size))
                .with_header("x-rb-serial", d::next_serial())
                .into_response()
        }))
        .with(Compression::new())
    };

    // rb:wiring etag.*
    // etag: middleware on the route, which is poem's own scoping.
    //
    // Poem ships no conditional handling, so the digest is the shared one and /__meta says
    // so. An Endpoint::with on the whole app would hash every response in the blend and
    // contaminate the rows this family is measured against.
    //
    // Shallow, which is the point: the handler runs and the body is built before anything
    // is compared, so the 304 saves the write and nothing else.
    let etag_route = |size: &'static str| {
        get(make(move |req: Request| async move {
            let asked = req
                .headers()
                .get(header::IF_NONE_MATCH)
                .and_then(|v| v.to_str().ok())
                .map(str::to_string);
            let raw = serde_json::to_vec(d::payload(size)).unwrap_or_default();
            let etag = d::content_etag(&raw);
            let base = if asked.as_deref() == Some(etag.as_str()) {
                Response::builder().status(StatusCode::NOT_MODIFIED).body(Body::empty())
            } else {
                Response::builder()
                    .content_type("application/json")
                    .body(Body::from(raw))
            };
            base.with_header(header::ETAG, etag)
                .with_header(header::CACHE_CONTROL, d::CACHEABLE)
                .with_header("x-rb-serial", d::next_serial())
                .into_response()
        }))
    };

    // rb:wiring cache.*
    // cache: the store consulted before the payload is built.
    //
    // Poem ships no response cache, so the store is the shared LRU sized from the fixture.
    // One store for the target rather than one per route, so the capacity the fixture
    // derives from the key count means what it says.
    let cache_route = |size: &'static str, on: &'static [&'static str]| {
        get(make(move |req: Request| async move {
            let values: Vec<String> = on
                .iter()
                .map(|name| {
                    req.headers()
                        .get(*name)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .to_string()
                })
                .collect();
            let key = d::cache_key(req.uri().path(), &values);
            let hit = match CACHE.get(&key) {
                Some(hit) => hit,
                None => {
                    let mut headers =
                        vec![("x-rb-serial".to_string(), d::next_serial())];
                    if !on.is_empty() {
                        headers.push(("vary".to_string(), on.join(", ")));
                    }
                    let fresh = d::StoredResponse {
                        status: 200,
                        headers,
                        body: serde_json::to_vec(d::payload(size)).unwrap_or_default(),
                    };
                    CACHE.put(key, fresh.clone());
                    fresh
                }
            };
            let mut builder = Response::builder()
                .status(StatusCode::from_u16(hit.status).unwrap_or(StatusCode::OK))
                .content_type("application/json");
            for (name, value) in hit.headers {
                builder = builder.header(name, value);
            }
            builder.body(Body::from(hit.body)).into_response()
        }))
    };

    // rb:wiring template.*
    let template_route = |size: &'static str| {
        get(make(move |_| async move {
            items_html(size)
                .with_content_type("text/html; charset=utf-8")
                .into_response()
        }))
    };

    let app = Route::new()
        .at("/plaintext", get(make(|_| async {
            "Hello, World!".with_content_type("text/plain; charset=utf-8").into_response()
        })))
        .at("/health", get(make(|_| async {
            "ok".with_content_type("text/plain; charset=utf-8").into_response()
        })))
        .at("/__meta", get(make(|_| async { Json(rb_host::meta("poem", "askama")) })))
        .at("/json/small", payload_route("small"))
        .at("/json/medium", payload_route("medium"))
        .at("/json/large", payload_route("large"))
        .at("/parameters/static/segment/literal", small())
        .at("/parameters/:one", small())
        .at("/parameters/:one/with-second/:two", small())
        .at("/query/one", get(query_one))
        .at("/query/many", get(query_many))
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 27 nobody asked for.
        .at("/headers", small())
        .at("/middleware/none", small())
        .at("/middleware/four", layered(4, small().boxed()))
        .at("/middleware/sixteen", layered(16, small().boxed()))
        // poem middleware, not a check inside the handler. An `if` in the handler would
        // measure the language; the point of the authorized family is the plumbing.
        .at(
            "/authorized/small",
            small().around(|ep, req| async move {
                let header = req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
                if d::token_ok(header) {
                    ep.call(req).await
                } else {
                    Ok(Json(d::forbidden_body()).with_status(StatusCode::FORBIDDEN).into_response())
                }
            }),
        )
        .at("/compressed/small", compressed_route("small"))
        .at("/compressed/medium", compressed_route("medium"))
        .at("/compressed/large", compressed_route("large"))
        // rb:handler etag.*
        .at("/etag/small", etag_route("small"))
        .at("/etag/large", etag_route("large"))
        // rb:handler cache.small,cache.medium,cache.large
        .at("/cache/small", cache_route("small", &[]))
        .at("/cache/medium", cache_route("medium", &[]))
        .at("/cache/large", cache_route("large", &[]))
        // rb:handler cache.vary_one,cache.vary_many
        .at("/cache/vary/one", cache_route("small", VARY_ONE))
        .at("/cache/vary/many", cache_route("small", VARY_MANY))
        .at("/template/small", template_route("small"))
        .at("/template/medium", template_route("medium"))
        // bind parses and binds without validating, so validate minus bind is the
        // validator alone rather than the validator plus the parse.
        .at("/body/bind/small", post(bind))
        .at("/body/bind/medium", post(bind))
        .at("/body/validate/small", post(validate_all))
        .at("/body/validate/medium", post(validate_all))
        .at("/body/validate/first-error", post(validate_first))
        .at("/domain/orders", get(filter).post(create))
        .at("/domain/orders/:oid", get(lookup).put(replace))
        .at("/domain/customers/:cid/summary", get(join))
        .at("/domain/regions/:region/report", get(aggregate))
        .at("/domain/customers/:cid", poem::patch(patch_customer))
        .at("/domain/orders/:oid/lines/:lid", poem::delete(delete_line))
        // NotFoundError only. catch_all_error swallows every error a handler returns as
        // well, which turned all three validation rejections into 404s.
        // rb:handler errors.unmatched
        .catch_error(|_: poem::error::NotFoundError| async { not_found().await });

    Server::new(TcpListener::bind(("0.0.0.0", port))).run(app).await
}

#[poem::handler]
async fn bind(body: Vec<u8>) -> Result<Json<d::BindResult>, Rejected> {
    Ok(Json(d::bind_echo(parse(&body)?)))
}

#[poem::handler]
async fn validate_all(Json(order): Json<OrderIn>) -> Result<Json<d::ValidatedOrder>, Rejected> {
    Ok(Json(validated(&order, false)?))
}

#[poem::handler]
async fn validate_first(Json(order): Json<OrderIn>) -> Result<Json<d::ValidatedOrder>, Rejected> {
    Ok(Json(validated(&order, true)?))
}

#[poem::handler]
async fn query_one(Query(q): Query<QueryOne>) -> Json<QueryOne> {
    Json(q)
}

#[poem::handler]
async fn query_many(Query(q): Query<QueryMany>) -> Json<QueryMany> {
    Json(q)
}

#[poem::handler]
async fn filter(Query(f): Query<OrderFilter>) -> Json<d::OrdersPage> {
    Json(d::domain_filter(f.page, f.size, &f.status))
}

#[poem::handler]
async fn lookup(Path(oid): Path<String>) -> R<Json<&'static d::Order>> {
    Ok(Json(d::get_order(&oid)?))
}

#[poem::handler]
async fn join(Path(cid): Path<String>) -> R<Json<d::JoinSummary>> {
    Ok(Json(d::domain_join(&cid)?))
}

#[poem::handler]
async fn aggregate(Path(region): Path<String>) -> R<Json<d::Report>> {
    Ok(Json(d::domain_aggregate(&region)?))
}

#[poem::handler]
async fn create(Json(order): Json<OrderIn>) -> Result<Response, Rejected> {
    let v = validated(&order, false)?;
    Ok(Json(v)
        .with_status(StatusCode::CREATED)
        .with_header(header::LOCATION, d::created_location())
        .into_response())
}

#[poem::handler]
async fn replace(
    Path(oid): Path<String>,
    Json(order): Json<OrderIn>,
) -> Result<Json<d::ValidatedOrder>, Rejected> {
    let existing = d::get_order(&oid).map_err(|e| not_found_rejection(e))?;
    let mut v = validated(&order, false)?;
    v.id = Some(existing.id);
    Ok(Json(v))
}

#[poem::handler]
async fn patch_customer(
    Path(cid): Path<String>,
    body: Vec<u8>,
) -> Result<Json<d::Customer>, Rejected> {
    let v = parse(&body)?;
    Ok(Json(d::patch_customer(&cid, &v).map_err(|e| not_found_rejection(e))?))
}

#[poem::handler]
async fn delete_line(Path((oid, lid)): Path<(String, String)>) -> R<Response> {
    d::get_order_line(&oid, &lid)?;
    Ok(Response::builder().status(StatusCode::NO_CONTENT).body(Body::empty()))
}
