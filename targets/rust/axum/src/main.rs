//! RequestBench target: axum. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses axum's own facility rather than an `if` in the handler, and
//! each one is scoped to its own routes. Compression registered on the router would put a
//! "did the client ask?" check on all forty-five endpoints and contaminate the rows the
//! compressed family is measured against, which is the whole reason those rows have their
//! own paths instead of riding on /json with an accept-encoding header.

use axum::{
    extract::{Path, RawQuery, Request},
    http::{header, HeaderMap, StatusCode},
    middleware::{from_fn, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, MethodRouter},
    Json, Router,
};
use rb_domain as d;
use serde_json::Value;
use tower_http::compression::{predicate::SizeAbove, CompressionLayer};

// ---- shared response shapes ---------------------------------------------------

/// Maps the domain's failures onto statuses. Handlers return `Result` and never build a
/// 404 or a 422 themselves, so the three targets that share this file cannot drift.
fn fail(e: d::Fail) -> Response {
    match e {
        d::Fail::NotFound => (StatusCode::NOT_FOUND, Json(d::not_found_body())).into_response(),
        d::Fail::Invalid(errs) => {
            (StatusCode::UNPROCESSABLE_ENTITY, Json(d::invalid_body(&errs))).into_response()
        }
    }
}

fn ok<T: serde::Serialize>(v: Result<T, d::Fail>) -> Response {
    match v {
        Ok(v) => Json(v).into_response(),
        Err(e) => fail(e),
    }
}

/// The request body as a value, or the 422 every target answers when it is not JSON.
fn parse(body: &[u8]) -> Result<Value, d::Fail> {
    serde_json::from_slice(body).map_err(|_| d::malformed_body())
}

fn query(raw: Option<String>) -> d::Query {
    d::parse_query(raw.as_deref().unwrap_or(""))
}

// ---- middleware ---------------------------------------------------------------

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

/// One middleware layer: it calls the next and does nothing else.
async fn noop(req: Request, next: Next) -> Response {
    next.run(req).await
}

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

async fn meta() -> Json<Value> {
    Json(rb_host::meta("axum"))
}

async fn small() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(d::not_found_body())).into_response()
}

/// The three sizes are static routes, not `/json/{size}`. The size set is fixed, so a
/// capture would make the router pay parameter cost on the family every other target
/// serves from a static route, and it would answer 200 with an empty body for a size that
/// does not exist.
fn payload_route(size: &'static str) -> MethodRouter {
    get(move || async move { Json(d::payload(size)) })
}

/// Compression is the framework's, configured to the pinned level. The size threshold is
/// left at the library's default: whether a framework bothers to compress a body too small
/// to benefit is what `compressed.gzip_small` is in the set to show, so forcing it would
/// erase the answer.
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
            .quality(tower_http::CompressionLevel::Precise(d::GZIP_LEVEL as i32))
            .compress_when(SizeAbove::new(32)),
    )
}

/// Sets the validators and answers the conditional. The ETag is pinned in the fixture, so
/// what this measures is emitting the header and comparing it rather than hashing a body.
///
/// The comparison requires a non-empty header: matching a missing `if-none-match` against
/// an empty ETag answers 304 to a client that never asked a conditional question.
fn cached_route(size: &'static str) -> MethodRouter {
    get(move |headers: HeaderMap| async move {
        let etag = d::etag_of(size);
        let hdrs = [
            (header::ETAG, etag.to_string()),
            (header::CACHE_CONTROL, d::CACHEABLE.to_string()),
            (header::HeaderName::from_static("x-rb-serial"), d::next_serial()),
        ];
        let inm = headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()).unwrap_or("");
        if !inm.is_empty() && inm == etag {
            return (StatusCode::NOT_MODIFIED, hdrs).into_response();
        }
        (hdrs, Json(d::payload(size))).into_response()
    })
}

fn template_route(size: &'static str) -> MethodRouter {
    get(move || async move {
        (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            rb_host::render_items(d::payload(size)),
        )
    })
}

// ---- main ---------------------------------------------------------------------

#[tokio::main]
async fn main() {
    let port = rb_host::boot("axum");

    let app = Router::new()
        .route("/plaintext", get(plaintext))
        .route("/health", get(health))
        .route("/__meta", get(meta))
        .route("/json/small", payload_route("small"))
        .route("/json/medium", payload_route("medium"))
        .route("/json/large", payload_route("large"))
        .route("/parameters/static/segment/literal", get(small))
        .route("/parameters/{one}", get(small))
        .route("/parameters/{one}/with-second/{two}", get(small))
        .route(
            "/query/one",
            get(|RawQuery(q): RawQuery| async move { Json(d::coerce_one(&query(q))) }),
        )
        .route(
            "/query/many",
            get(|RawQuery(q): RawQuery| async move { Json(d::coerce_many(&query(q))) }),
        )
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 27 nobody asked for.
        .route("/headers", get(small))
        .route("/middleware/none", get(small))
        .route("/middleware/four", layered(4, get(small)))
        .route("/middleware/sixteen", layered(16, get(small)))
        .route("/authorized/small", get(small).layer(from_fn(require_token)))
        .route("/compressed/small", compressed_route("small"))
        .route("/compressed/medium", compressed_route("medium"))
        .route("/compressed/large", compressed_route("large"))
        .route("/cached/small", cached_route("small"))
        .route("/cached/medium", cached_route("medium"))
        .route("/cached/large", cached_route("large"))
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
            get(|RawQuery(q): RawQuery| async move { Json(d::domain_filter(&query(q))) })
                .post(create_order),
        )
        .route("/domain/orders/{oid}", get(lookup_order).put(replace_order))
        .route("/domain/customers/{cid}/summary", get(join))
        .route("/domain/regions/{region}/report", get(aggregate))
        .route("/domain/customers/{cid}", patch(patch_customer))
        .route("/domain/orders/{oid}/lines/{lid}", delete(delete_line))
        // rb:snippet errors.unmatched
        .fallback(not_found);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn bind(body: axum::body::Bytes) -> Response {
    match parse(&body) {
        Ok(v) => Json(d::bind_echo(v)).into_response(),
        Err(e) => fail(e),
    }
}

async fn validate_all(body: axum::body::Bytes) -> Response {
    match parse(&body).and_then(|v| d::validate_order(&v, false)) {
        Ok(v) => Json(v).into_response(),
        Err(e) => fail(e),
    }
}

async fn validate_first(body: axum::body::Bytes) -> Response {
    match parse(&body).and_then(|v| d::validate_order(&v, true)) {
        Ok(v) => Json(v).into_response(),
        Err(e) => fail(e),
    }
}

async fn lookup_order(Path(oid): Path<String>) -> Response {
    ok(d::get_order(&oid))
}

async fn join(Path(cid): Path<String>) -> Response {
    ok(d::domain_join(&cid))
}

async fn aggregate(Path(region): Path<String>) -> Response {
    ok(d::domain_aggregate(&region))
}

async fn create_order(body: axum::body::Bytes) -> Response {
    match parse(&body).and_then(|v| d::validate_order(&v, false)) {
        Ok(v) => (
            StatusCode::CREATED,
            [(header::LOCATION, d::created_location())],
            Json(v),
        )
            .into_response(),
        Err(e) => fail(e),
    }
}

async fn replace_order(Path(oid): Path<String>, body: axum::body::Bytes) -> Response {
    let existing = match d::get_order(&oid) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    match parse(&body).and_then(|v| d::validate_order(&v, false)) {
        Ok(mut v) => {
            v.id = Some(existing.id);
            Json(v).into_response()
        }
        Err(e) => fail(e),
    }
}

async fn patch_customer(Path(cid): Path<String>, body: axum::body::Bytes) -> Response {
    match parse(&body).and_then(|v| d::patch_customer(&cid, &v)) {
        Ok(v) => Json(v).into_response(),
        Err(e) => fail(e),
    }
}

async fn delete_line(Path((oid, lid)): Path<(String, String)>) -> Response {
    match d::get_order_line(&oid, &lid) {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => fail(e),
    }
}
