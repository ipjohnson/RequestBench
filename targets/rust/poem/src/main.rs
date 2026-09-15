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
    web::{Json, Path},
    endpoint::make,
    Body, Endpoint, EndpointExt, IntoResponse, Request, Response, Route, Server,
};
use rb_domain as d;
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
            d::Fail::Invalid(_) => StatusCode::UNPROCESSABLE_ENTITY,
        }
    }
    fn as_response(&self) -> Response {
        let body = match &self.0 {
            d::Fail::NotFound => d::not_found_body(),
            d::Fail::Invalid(errs) => d::invalid_body(errs),
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

fn parse(body: &[u8]) -> R<Value> {
    serde_json::from_slice(body).map_err(|_| Failed(d::malformed_body()))
}

fn query(req: &Request) -> d::Query {
    d::parse_query(req.uri().query().unwrap_or(""))
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
        .at("/query/one", get(make(|req: Request| async move { Json(d::coerce_one(&query(&req))) })))
        .at("/query/many", get(make(|req: Request| async move { Json(d::coerce_many(&query(&req))) })))
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
async fn bind(body: Vec<u8>) -> R<Json<d::BindResult>> {
    Ok(Json(d::bind_echo(parse(&body)?)))
}

#[poem::handler]
async fn validate_all(body: Vec<u8>) -> R<Json<d::ValidatedOrder>> {
    Ok(Json(d::validate_order(&parse(&body)?, false)?))
}

#[poem::handler]
async fn validate_first(body: Vec<u8>) -> R<Json<d::ValidatedOrder>> {
    Ok(Json(d::validate_order(&parse(&body)?, true)?))
}

#[poem::handler]
async fn filter(req: &Request) -> Json<d::OrdersPage> {
    Json(d::domain_filter(&query(req)))
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
async fn create(body: Vec<u8>) -> R<Response> {
    let v = d::validate_order(&parse(&body)?, false)?;
    Ok(Json(v)
        .with_status(StatusCode::CREATED)
        .with_header(header::LOCATION, d::created_location())
        .into_response())
}

#[poem::handler]
async fn replace(Path(oid): Path<String>, body: Vec<u8>) -> R<Json<d::ValidatedOrder>> {
    let existing = d::get_order(&oid)?;
    let mut v = d::validate_order(&parse(&body)?, false)?;
    v.id = Some(existing.id);
    Ok(Json(v))
}

#[poem::handler]
async fn patch_customer(Path(cid): Path<String>, body: Vec<u8>) -> R<Json<d::Customer>> {
    Ok(Json(d::patch_customer(&cid, &parse(&body)?)?))
}

#[poem::handler]
async fn delete_line(Path((oid, lid)): Path<(String, String)>) -> R<Response> {
    d::get_order_line(&oid, &lid)?;
    Ok(Response::builder().status(StatusCode::NO_CONTENT).body(Body::empty()))
}
