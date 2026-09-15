//! RequestBench target: actix-web. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses actix's own facility rather than an `if` in the handler.
//! Compress is wrapped around the compressed scope alone: registered on the App it would
//! put a "did the client ask?" check on all forty-five endpoints and contaminate the rows
//! the compressed family is measured against.

use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    http::{header, StatusCode},
    middleware::{Compress, Next},
    web, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use rb_domain as d;
use serde_json::Value;

fn fail(e: d::Fail) -> HttpResponse {
    match e {
        d::Fail::NotFound => HttpResponse::NotFound().json(d::not_found_body()),
        d::Fail::Invalid(errs) => HttpResponse::UnprocessableEntity().json(d::invalid_body(&errs)),
    }
}

fn ok<T: serde::Serialize>(v: Result<T, d::Fail>) -> HttpResponse {
    match v {
        Ok(v) => HttpResponse::Ok().json(v),
        Err(e) => fail(e),
    }
}

fn parse(body: &[u8]) -> Result<Value, d::Fail> {
    serde_json::from_slice(body).map_err(|_| d::malformed_body())
}

fn query(req: &HttpRequest) -> d::Query {
    d::parse_query(req.query_string())
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
    HttpResponse::Ok().json(rb_host::meta("actix-web"))
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

/// Sets the validators and answers the conditional. The comparison requires a non-empty
/// header: matching a missing `if-none-match` against an empty ETag answers 304 to a
/// client that never asked a conditional question.
fn cached_route(size: &'static str) -> actix_web::Route {
    web::get().to(move |req: HttpRequest| async move {
        let etag = d::etag_of(size);
        let inm =
            req.headers().get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()).unwrap_or("");
        let fresh = !inm.is_empty() && inm == etag;
        let mut b = if fresh {
            HttpResponse::build(StatusCode::NOT_MODIFIED)
        } else {
            HttpResponse::Ok()
        };
        b.insert_header((header::ETAG, etag))
            .insert_header((header::CACHE_CONTROL, d::CACHEABLE))
            .insert_header(("x-rb-serial", d::next_serial()));
        if fresh { b.finish() } else { b.json(d::payload(size)) }
    })
}

fn template_route(size: &'static str) -> actix_web::Route {
    web::get().to(move || async move {
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(rb_host::render_items(d::payload(size)))
    })
}

async fn bind(body: web::Bytes) -> HttpResponse {
    match parse(&body) {
        Ok(v) => HttpResponse::Ok().json(d::bind_echo(v)),
        Err(e) => fail(e),
    }
}

async fn validate_all(body: web::Bytes) -> HttpResponse {
    ok(parse(&body).and_then(|v| d::validate_order(&v, false)))
}

async fn validate_first(body: web::Bytes) -> HttpResponse {
    ok(parse(&body).and_then(|v| d::validate_order(&v, true)))
}

async fn filter(req: HttpRequest) -> HttpResponse {
    HttpResponse::Ok().json(d::domain_filter(&query(&req)))
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

async fn create(body: web::Bytes) -> HttpResponse {
    match parse(&body).and_then(|v| d::validate_order(&v, false)) {
        Ok(v) => HttpResponse::Created()
            .insert_header((header::LOCATION, d::created_location()))
            .json(v),
        Err(e) => fail(e),
    }
}

async fn replace(p: web::Path<String>, body: web::Bytes) -> HttpResponse {
    let existing = match d::get_order(&p) {
        Ok(o) => o,
        Err(e) => return fail(e),
    };
    match parse(&body).and_then(|v| d::validate_order(&v, false)) {
        Ok(mut v) => {
            v.id = Some(existing.id);
            HttpResponse::Ok().json(v)
        }
        Err(e) => fail(e),
    }
}

async fn patch(p: web::Path<String>, body: web::Bytes) -> HttpResponse {
    ok(parse(&body).and_then(|v| d::patch_customer(&p, &v)))
}

async fn delete_line(p: web::Path<(String, String)>) -> HttpResponse {
    match d::get_order_line(&p.0, &p.1) {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => fail(e),
    }
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
            .route("/query/one", web::get().to(|r: HttpRequest| async move {
                HttpResponse::Ok().json(d::coerce_one(&query(&r)))
            }))
            .route("/query/many", web::get().to(|r: HttpRequest| async move {
                HttpResponse::Ok().json(d::coerce_many(&query(&r)))
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
            .route("/cached/small", cached_route("small"))
            .route("/cached/medium", cached_route("medium"))
            .route("/cached/large", cached_route("large"))
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
