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


fn ok<T: serde::Serialize>(v: Result<T, d::Fail>) -> HttpResponse {
    match v {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(e) => fail(e),
    }
}

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
// rejects what will not fit without the handler seeing it. The struct it fills is the
// struct the handler answers.
//
// The fields are plain, so serde decides what a missing or unparseable one is: a
// QueryPayloadError, which actix renders as its own 400. The endpoint set sends neither.

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

async fn small() -> impl Responder {
    HttpResponse::Ok().json(d::payload("small"))
}

async fn not_found() -> impl Responder {
    HttpResponse::NotFound().json(d::not_found_body())
}

/// Static routes, not `/json/{size}`: the size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route,
/// and it would answer 200 with an empty body for a size that does not exist. The size is
/// closed over rather than read back out of the path.
fn payload_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move { HttpResponse::Ok().json(d::payload(size)) })
}

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

fn etag_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .insert_header(("x-rb-serial", d::next_serial()))
            .json(d::payload(size))
    })
}

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

fn template_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(items_html(size))
    })
}

async fn bind(body: web::Bytes) -> HttpResponse {
    match parse(&body) {
        Ok(v) => HttpResponse::Ok().json(d::bind_echo(v)),
        Err(r) => r,
    }
}

async fn validate_all(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, false) {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(r) => r,
    }
}

async fn validate_first(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, true) {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(r) => r,
    }
}

async fn filter(f: web::Query<OrderFilter>) -> HttpResponse {
    HttpResponse::Ok().json(d::domain_filter(f.page, f.size, &f.status))
}

async fn lookup(p: web::Path<String>) -> HttpResponse {
    ok(d::get_order(&p))
}

async fn join(p: web::Path<String>) -> HttpResponse {
    ok(d::domain_join(&p))
}

async fn aggregate(p: web::Path<String>) -> HttpResponse {
    ok(d::domain_aggregate(&p))
}

async fn create(order: web::Json<OrderIn>) -> HttpResponse {
    match validated(&order, false) {
        Ok(v) => HttpResponse::Created()
            .insert_header((header::LOCATION, d::created_location()))
            .json(v),
        Err(r) => r,
    }
}

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

async fn patch(p: web::Path<String>, body: web::Bytes) -> HttpResponse {
    let v = match parse(&body) {
        Ok(v) => v,
        Err(r) => return r,
    };
    ok(d::patch_customer(&p, &v))
}

async fn delete_line(p: web::Path<(String, String)>) -> HttpResponse {
    match d::get_order_line(&p.0, &p.1) {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => fail(e),
    }
}

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

fn items_html(size: &'static str) -> String {
    use askama::Template;
    Items { body: d::payload(size) }.render().unwrap_or_default()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = rb_host::boot("actix-web");
    HttpServer::new(|| {
        App::new()
            .route("/plaintext", web::get().to(plaintext))
            .route("/health", web::get().to(health))
            .route("/__meta", web::get().to(meta))
            .route("/json/small", payload_route("small"))
            .route("/json/medium", payload_route("medium"))
            .route("/json/large", payload_route("large"))
            .route("/parameters/static/segment/literal", web::get().to(small))
            .route("/parameters/{one}", web::get().to(small))
            .route("/parameters/{one}/with-second/{two}", web::get().to(small))
            .route("/query/one", web::get().to(|q: web::Query<QueryOne>| async move {
                HttpResponse::Ok().json(q.into_inner())
            }))
            .route("/query/many", web::get().to(|q: web::Query<QueryMany>| async move {
                HttpResponse::Ok().json(q.into_inner())
            }))
            .route("/headers", web::get().to(small))
            .route("/middleware/none", web::get().to(small))
            .service(noops!(web::resource("/middleware/four").route(web::get().to(small)), 4))
            .service(noops!(web::resource("/middleware/sixteen").route(web::get().to(small)), 16))
            .service(
                web::resource("/authorized/small")
                    .wrap(actix_web::middleware::from_fn(require_token))
                    .route(web::get().to(small)),
            )
            // Level pinned across every language; the default size threshold is left
            // alone, because whether a framework bothers to compress a body too small to
            // benefit is what compressed.gzip_small is in the set to show.
            // rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
            // rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
            .service(
                web::scope("/compressed")
                    .wrap(Compress::default())
                    .route("/small", compressed_route("small"))
                    .route("/medium", compressed_route("medium"))
                    .route("/large", compressed_route("large")),
            )
            .service(
                // rb:snippet etag.small etag.large etag.match_large etag.stale_large
                web::scope("/etag")
                    .wrap(from_fn(revalidate))
                    .route("/small", etag_route("small"))
                    .route("/large", etag_route("large")),
            )
            // The vary scopes come first: actix matches scopes in registration order, and
            // /cache would otherwise claim /cache/vary/one and answer its own 404.
            // rb:snippet cache.vary_one cache.vary_many
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
                // rb:snippet cache.small cache.medium cache.large
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
            // rb:snippet errors.unmatched
            .default_service(web::to(not_found))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
