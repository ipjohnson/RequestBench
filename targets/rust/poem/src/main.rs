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
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

/// Every route poem does not match. Its own 404 carries no body, and every other target
/// answers the same JSON, so the shape is supplied rather than left to the framework.
async fn not_found() -> Response {
    Json(d::not_found_body()).with_status(StatusCode::NOT_FOUND).into_response()
}

/// Boxed so the count is a fold rather than sixteen written-out calls. Each layer is a
/// real poem middleware that calls the next and does nothing else.
fn layered(n: usize, ep: poem::endpoint::BoxEndpoint<'static>) -> poem::endpoint::BoxEndpoint<'static> {
    (0..n).fold(ep, |acc, _| acc.around(|ep, req| async move { ep.call(req).await }).boxed())
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    let port = rb_host::boot("poem");

    let small = || get(make(|_| async { Json(d::payload("small")) }));

    let payload_route =
        |size: &'static str| get(make(move |_| async move { Json(d::payload(size)) }));

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

    // The ETag is pinned in the fixture, so what this measures is emitting the header and
    // comparing it rather than hashing a body. The comparison requires a non-empty header:
    // matching a missing if-none-match against an empty ETag answers 304 to a client that
    // never asked a conditional question.
    let cached_route = |size: &'static str| {
        get(make(move |req: Request| async move {
            let etag = d::etag_of(size);
            let inm = req
                .headers()
                .get(header::IF_NONE_MATCH)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            let fresh = !inm.is_empty() && inm == etag;
            let base = if fresh {
                Response::builder().status(StatusCode::NOT_MODIFIED).body(Body::empty())
            } else {
                Json(d::payload(size)).into_response()
            };
            base.with_header(header::ETAG, etag)
                .with_header(header::CACHE_CONTROL, d::CACHEABLE)
                .with_header("x-rb-serial", d::next_serial())
                .into_response()
        }))
    };

    let template_route = |size: &'static str| {
        get(make(move |_| async move {
            rb_host::render_items(d::payload(size))
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
        .at("/__meta", get(make(|_| async { Json(rb_host::meta("poem")) })))
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
        .at("/cached/small", cached_route("small"))
        .at("/cached/medium", cached_route("medium"))
        .at("/cached/large", cached_route("large"))
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
        // rb:snippet errors.unmatched
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
