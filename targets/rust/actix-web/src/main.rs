//! RequestBench target: actix-web. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses actix's own facility rather than an `if` in the handler.
//! Compress is wrapped around the compressed scope alone: registered on the App it would
//! put a "did the client ask?" check on all forty-five endpoints and contaminate the rows
//! the compressed family is measured against.

use actix_web::{
    body::{BoxBody, EitherBody, MessageBody},
    dev::{ServiceRequest, ServiceResponse},
    http::{header, StatusCode},
    middleware::{from_fn, Compress, Next},
    web, App, HttpResponse, HttpServer, Responder,
};
use rb_domain as d;

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because middleware takes a &'static and the values are the
/// same constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];
use serde::{Deserialize, Serialize};
use serde_json::Value;

// rb:wiring errors.*,domain.*
fn fail(e: d::Fail) -> HttpResponse {
    match e {
        d::Fail::NotFound => HttpResponse::NotFound().json(d::not_found_body()),
    }
}

// ---- validation: actix's typed Json extractor, and this target's own rules -----
//
// `web::Json<OrderIn>` is the framework's binding half: actix deserializes into the
// struct before the handler runs and rejects a body that will not fit without the handler
// seeing it. These routes used to take `web::Bytes` and call serde_json::from_slice,
// which made the extractor a no-op and the binding this repository's rather than actix's.
//
// actix does not separate a body that is not JSON from one that is JSON of the wrong
// shape: both are a JsonPayloadError and both answer 400. axum draws that line and
// answers 422 for the second, which is one of the differences #35 exists to show.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because actix has no
// validation layer to put them in.

// rb:wiring body.*,domain.*
/// The order body as actix binds it. serde reports the first field that does not fit.
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
fn validated(order: &OrderIn, first_error: bool) -> Result<d::ValidatedOrder, HttpResponse> {
    let errs = check(order, first_error);
    if !errs.is_empty() {
        return Err(HttpResponse::UnprocessableEntity()
            .json(serde_json::json!({ "error": "validation_failed", "errors": errs })));
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Ok(d::price_order(order.customer_id, &order.status, &lines))
}


// rb:wiring domain.*,errors.*
fn ok<T: serde::Serialize>(v: Result<T, d::Fail>) -> HttpResponse {
    match v {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(e) => fail(e),
    }
}

// rb:wiring body.*,domain.*
/// An unvalidated body, for the endpoints that only parse. The validate routes use the
/// extractor; this is only for bind, which is measured against them.
fn parse(body: &[u8]) -> Result<Value, HttpResponse> {
    serde_json::from_slice(body).map_err(|e| {
        HttpResponse::BadRequest()
            .json(serde_json::json!({ "error": "invalid_body", "detail": e.to_string() }))
    })
}

// ---- query: actix's typed Query extractor -------------------------------------
//
// `web::Query<T>` is the framework's binding half, the same shape as `web::Json<T>` on the
// body: actix deserializes the query string into the struct before the handler runs and
// rejects what will not fit without the handler seeing it. The struct it fills is what the
// handler echoes beside the small payload.
//
// The fields are plain, so serde decides what a missing or unparseable one is: a
// QueryPayloadError, which actix renders as its own 400. The endpoint set sends neither.

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

// ---- parameters and headers: actix's typed Path and Header extractors ---------
//
// `web::Path<T>` binds the captures the way `web::Query<T>` binds a query string: actix
// deserializes them into the struct before the handler runs, and the struct it fills is the
// echo. A capture that is not an integer is actix's own 404.
//
// `web::Header<T>` is actix's typed header extractor. A header of this repository's own
// needs a Header impl naming it, and each one parses through actix's own from_one_raw_str,
// which is FromStr. So the account arrives as an integer before the handler runs, and a
// header that is missing or will not parse is actix's own 400. The endpoint set sends
// neither.

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
/// A header web::Header can bind, by name and type. The value side is never used, and
/// actix requires it of every Header.
macro_rules! typed_header {
    ($name:ident, $header:literal, $ty:ty) => {
        struct $name($ty);

        impl header::TryIntoHeaderValue for $name {
            type Error = header::InvalidHeaderValue;

            fn try_into_value(self) -> Result<header::HeaderValue, Self::Error> {
                header::HeaderValue::from_str(&self.0.to_string())
            }
        }

        impl header::Header for $name {
            fn name() -> header::HeaderName {
                header::HeaderName::from_static($header)
            }

            fn parse<M: actix_web::HttpMessage>(
                msg: &M,
            ) -> Result<Self, actix_web::error::ParseError> {
                header::from_one_raw_str(msg.headers().get(Self::name())).map($name)
            }
        }
    };
}

// rb:wiring headers.*
typed_header!(Tenant, "x-rb-tenant", String);
typed_header!(RequestId, "x-rb-request-id", String);
typed_header!(Account, "x-rb-account", i64);
// rb:end

// rb:wiring headers.*
#[derive(Serialize)]
struct BoundHeaders {
    tenant: String,
    request_id: String,
    account: i64,
}

// rb:wiring authorized.*
/// actix middleware, not a check inside the handler. An `if` in the handler would measure
/// the language; the point of the authorized family is the framework's own plumbing.
async fn require_token(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let allowed =
        d::token_ok(req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()));
    if allowed {
        return next.call(req).await.map(ServiceResponse::map_into_boxed_body);
    }
    // The response, not an error. actix renders an error's payload as text/plain, and the
    // gate requires every JSON body to declare itself as JSON.
    Ok(req
        .into_response(HttpResponse::Forbidden().json(d::forbidden_body()))
        .map_into_boxed_body())
}

// rb:wiring middleware.*
/// One middleware layer: it calls the next and does nothing else.
async fn noop(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    next.call(req).await
}

/// Repetition rather than a loop: every `wrap` changes the service type, so the count has
/// to be written out. The macro keeps it one line per route instead of sixteen.
macro_rules! noops {
    ($r:expr, 1) => {
        $r.wrap(actix_web::middleware::from_fn(noop))
    };
    ($r:expr, 4) => {
        noops!(noops!(noops!(noops!($r, 1), 1), 1), 1)
    };
    ($r:expr, 16) => {
        noops!(noops!(noops!(noops!($r, 4), 4), 4), 4)
    };
}

async fn plaintext() -> impl Responder {
    HttpResponse::Ok().content_type("text/plain; charset=utf-8").body("Hello, World!")
}

async fn health() -> impl Responder {
    HttpResponse::Ok().content_type("text/plain; charset=utf-8").body("ok")
}

async fn meta() -> impl Responder {
    HttpResponse::Ok().json(rb_host::meta("actix-web", "askama"))
}

// rb:wiring parameters.*,headers.*,middleware.*,authorized.*
async fn small() -> impl Responder {
    HttpResponse::Ok().json(d::payload("small"))
}

// rb:wiring parameters.*
async fn param_one(p: web::Path<ParamOne>) -> HttpResponse {
    HttpResponse::Ok().json(d::with_echo("small", p.into_inner()))
}

// rb:wiring parameters.*
async fn param_two(p: web::Path<ParamTwo>) -> HttpResponse {
    HttpResponse::Ok().json(d::with_echo("small", p.into_inner()))
}

// rb:wiring headers.*
async fn bind_headers(
    web::Header(Tenant(tenant)): web::Header<Tenant>,
    web::Header(RequestId(request_id)): web::Header<RequestId>,
    web::Header(Account(account)): web::Header<Account>,
) -> HttpResponse {
    HttpResponse::Ok().json(d::with_echo("small", BoundHeaders { tenant, request_id, account }))
}

// rb:wiring errors.*
async fn not_found() -> impl Responder {
    HttpResponse::NotFound().json(d::not_found_body())
}

// rb:wiring json.*
/// Static routes, not `/json/{size}`: the size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route,
/// and it would answer 200 with an empty body for a size that does not exist. The size is
/// closed over rather than read back out of the path.
fn payload_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move { HttpResponse::Ok().json(d::payload(size)) })
}

// rb:wiring compressed.*
fn compressed_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .insert_header(("x-rb-serial", d::next_serial()))
            .json(d::payload(size))
    })
}

/// etag: middleware on a scope, which is how actix-web scopes anything.
///
/// Nothing in actix-web computes a validator for a dynamic response, so the digest is the
/// shared one and `/__meta` says so. A `wrap` on the App would hash every response in the
/// blend and contaminate the rows this family is measured against; a `wrap` on the scope
/// reaches these two routes and no others, the same way the compressed family gets its
/// codec.
///
/// Shallow, which is the point: the handler runs and the body is built before anything is
/// compared, so the 304 saves the write and nothing else.
async fn revalidate(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<EitherBody<BoxBody>>, actix_web::Error> {
    let asked = req
        .headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let response = next.call(req).await?;
    let (request, response) = response.into_parts();
    let (mut response, body) = response.into_parts();
    let raw = actix_web::body::to_bytes(body).await.unwrap_or_default();
    let etag = d::content_etag(&raw);
    response.headers_mut().insert(header::ETAG, etag.parse().unwrap());
    response.headers_mut().insert(header::CACHE_CONTROL, d::CACHEABLE.parse().unwrap());
    if asked.as_deref() == Some(etag.as_str()) {
        let mut not_modified = HttpResponse::build(StatusCode::NOT_MODIFIED);
        for (name, value) in response.headers() {
            not_modified.insert_header((name.clone(), value.clone()));
        }
        return Ok(ServiceResponse::new(
            request,
            not_modified.finish().map_into_left_body(),
        ));
    }
    let rebuilt = response.set_body(BoxBody::new(raw));
    Ok(ServiceResponse::new(request, rebuilt).map_into_left_body())
}

// rb:wiring etag.*
fn etag_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .insert_header(("x-rb-serial", d::next_serial()))
            .json(d::payload(size))
    })
}

// rb:wiring cache.*
/// cache: middleware that answers from the store before the handler is reached.
///
/// actix-web ships no response cache, so the store is the shared LRU sized from the
/// fixture. One store for the target rather than one per route, so the capacity the fixture
/// derives from the key count means what it says.
static CACHE: std::sync::LazyLock<d::ResponseStore> =
    std::sync::LazyLock::new(d::ResponseStore::new);

async fn replay(
    on: &'static [&'static str],
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<EitherBody<BoxBody>>, actix_web::Error> {
    let values: Vec<String> = on
        .iter()
        .map(|name| {
            req.headers().get(*name).and_then(|v| v.to_str().ok()).unwrap_or("").to_string()
        })
        .collect();
    let key = d::cache_key(req.path(), &values);
    if let Some(hit) = CACHE.get(&key) {
        let mut b = HttpResponse::build(
            StatusCode::from_u16(hit.status).unwrap_or(StatusCode::OK),
        );
        for (name, value) in &hit.headers {
            b.insert_header((name.clone(), value.clone()));
        }
        let (request, _) = req.into_parts();
        return Ok(ServiceResponse::new(request, b.body(hit.body).map_into_left_body()));
    }
    let response = next.call(req).await?;
    let (request, response) = response.into_parts();
    let (response, body) = response.into_parts();
    let raw = actix_web::body::to_bytes(body).await.unwrap_or_default();
    if response.status() == StatusCode::OK {
        CACHE.put(
            key,
            d::StoredResponse {
                status: 200,
                headers: response
                    .headers()
                    .iter()
                    .map(|(n, v)| (n.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect(),
                body: raw.to_vec(),
            },
        );
    }
    let rebuilt = response.set_body(BoxBody::new(raw));
    Ok(ServiceResponse::new(request, rebuilt).map_into_left_body())
}

// rb:wiring cache.*
fn cache_route(size: &'static str, on: &'static [&'static str]) -> actix_web::Route {
    web::get().to(move || async move {
        let mut b = HttpResponse::Ok();
        b.insert_header(("x-rb-serial", d::next_serial()));
        if !on.is_empty() {
            b.insert_header((header::VARY, on.join(", ")));
        }
        b.json(d::payload(size))
    })
}

// rb:wiring template.*
fn template_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(items_html(size))
    })
}

// rb:wiring body.*
async fn bind(body: web::Bytes) -> HttpResponse {
    match parse(&body) {
        Ok(v) => HttpResponse::Ok().json(d::bind_echo(v)),
        Err(r) => r,
    }
}

// rb:wiring body.*
async fn validate_all(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, false) {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(r) => r,
    }
}

// rb:wiring body.*
async fn validate_first(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, true) {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(r) => r,
    }
}

// rb:wiring domain.*
async fn filter(f: web::Query<OrderFilter>) -> HttpResponse {
    HttpResponse::Ok().json(d::domain_filter(f.page, f.size, &f.status))
}

// rb:wiring domain.*,errors.*
async fn lookup(p: web::Path<String>) -> HttpResponse {
    ok(d::get_order(&p))
}

// rb:wiring domain.*
async fn join(p: web::Path<String>) -> HttpResponse {
    ok(d::domain_join(&p))
}

// rb:wiring domain.*
async fn aggregate(p: web::Path<String>) -> HttpResponse {
    ok(d::domain_aggregate(&p))
}

// rb:wiring domain.*
async fn create(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, false) {
        Ok(v) => HttpResponse::Created()
            .insert_header((header::LOCATION, d::created_location()))
            .json(v),
        Err(r) => r,
    }
}

// rb:wiring domain.*
async fn replace(p: web::Path<String>, order: web::Json<OrderIn>) -> HttpResponse {
    let existing = match d::get_order(&p) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    match validated(&order, false) {
        Ok(mut v) => {
            v.id = Some(existing.id);
            HttpResponse::Ok().json(v)
        }
        Err(r) => r,
    }
}

// rb:wiring domain.*
async fn patch(p: web::Path<String>, body: web::Bytes) -> HttpResponse {
    let v = match parse(&body) {
        Ok(v) => v,
        Err(r) => return r,
    };
    ok(d::patch_customer(&p, &v))
}

// rb:wiring domain.*
async fn delete_line(p: web::Path<(String, String)>) -> HttpResponse {
    match d::get_order_line(&p.0, &p.1) {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => fail(e),
    }
}

// rb:wiring template.*
// ---- template ------------------------------------------------------------------
//
// actix-web ships no view layer and recommends no engine. Askama is the
// compile-time engine axum's own examples reach for, and it is what every Rust target
// without a view layer renders with here.
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

#[cfg(test)]
mod suite;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = rb_host::boot("actix-web");
    let server = HttpServer::new(|| App::new().configure(config))
        .bind(("0.0.0.0", port))?;
    rb_host::listening();
    server.run().await
}

/// Every route, on the ServiceConfig App::configure hands over. Its own function so a test can
/// hand it requests: built inline in main(), the only way to reach it was to start this target
/// on its container port. main() serves an App configured with it.
fn config(cfg: &mut web::ServiceConfig) {
    cfg
        .route("/plaintext", web::get().to(plaintext))
        .route("/health", web::get().to(health))
        .route("/__meta", web::get().to(meta))
        .route("/json/small", payload_route("small"))
        .route("/json/medium", payload_route("medium"))
        .route("/json/large", payload_route("large"))
        .route("/parameters/static/segment/literal", web::get().to(small))
        .route("/parameters/{one}/segment/literal", web::get().to(param_one))
        .route("/parameters/{one}/with-second/{two}", web::get().to(param_two))
        .route("/query/one", web::get().to(|q: web::Query<QueryOne>| async move {
            HttpResponse::Ok().json(d::with_echo("small", q.into_inner()))
        }))
        .route("/query/many", web::get().to(|q: web::Query<QueryMany>| async move {
            HttpResponse::Ok().json(d::with_echo("small", q.into_inner()))
        }))
        .route("/headers", web::get().to(small))
        .route("/headers/bind", web::get().to(bind_headers))
        .route("/middleware/none", web::get().to(small))
        .service(noops!(web::resource("/middleware/four").route(web::get().to(small)), 4))
        .service(noops!(web::resource("/middleware/sixteen").route(web::get().to(small)), 16))
        .service(
            web::resource("/authorized/small")
                .wrap(actix_web::middleware::from_fn(require_token))
                .route(web::get().to(small)),
        )
        // Compress takes no level. actix-web gzips at flate2's fast level, which is level
        // 1. The default size threshold is left alone, because whether a framework bothers
        // to compress a body too small to benefit is what compressed.gzip_small is in the
        // set to show.
        // rb:handler compressed.*
        .service(
            web::scope("/compressed")
                .wrap(Compress::default())
                .route("/small", compressed_route("small"))
                .route("/medium", compressed_route("medium"))
                .route("/large", compressed_route("large")),
        )
        .service(
            // rb:handler etag.*
            web::scope("/etag")
                .wrap(from_fn(revalidate))
                .route("/small", etag_route("small"))
                .route("/large", etag_route("large")),
        )
        // The vary scopes come first: actix matches scopes in registration order, and
        // /cache would otherwise claim /cache/vary/one and answer its own 404.
        // rb:handler cache.vary_one,cache.vary_many
        .service(
            web::resource("/cache/vary/one")
                .wrap(from_fn(|req, next| replay(VARY_ONE, req, next)))
                .route(cache_route("small", VARY_ONE)),
        )
        .service(
            web::resource("/cache/vary/many")
                .wrap(from_fn(|req, next| replay(VARY_MANY, req, next)))
                .route(cache_route("small", VARY_MANY)),
        )
        .service(
            // rb:handler cache.small,cache.medium,cache.large
            web::scope("/cache")
                .wrap(from_fn(|req, next| replay(&[], req, next)))
                .route("/small", cache_route("small", &[]))
                .route("/medium", cache_route("medium", &[]))
                .route("/large", cache_route("large", &[])),
        )
        .route("/template/small", template_route("small"))
        .route("/template/medium", template_route("medium"))
        .route("/body/bind/small", web::post().to(bind))
        .route("/body/bind/medium", web::post().to(bind))
        .route("/body/validate/first-error", web::post().to(validate_first))
        .route("/body/validate/small", web::post().to(validate_all))
        .route("/body/validate/medium", web::post().to(validate_all))
        .route("/domain/orders", web::get().to(filter))
        .route("/domain/orders", web::post().to(create))
        .route("/domain/orders/{oid}", web::get().to(lookup))
        .route("/domain/orders/{oid}", web::put().to(replace))
        .route("/domain/customers/{cid}/summary", web::get().to(join))
        .route("/domain/regions/{region}/report", web::get().to(aggregate))
        .route("/domain/customers/{cid}", web::patch().to(patch))
        .route("/domain/orders/{oid}/lines/{lid}", web::delete().to(delete_line))
        // rb:handler errors.unmatched
        .default_service(web::to(not_found));
}
