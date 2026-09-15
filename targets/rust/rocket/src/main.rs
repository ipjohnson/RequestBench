//! RequestBench target: Rocket. Framework wiring only; behaviour from rb-domain.
//!
//! Rocket has no per-route middleware layer: a fairing is global and a guard is per route,
//! so the two families that are middleware elsewhere are request guards here. That is
//! Rocket's own facility for the job rather than an `if` in the handler, which is the rule
//! the whole set is wired by.
//!
//! Compression is the one place this target does the work itself. Rocket 0.5 ships no
//! compression, and the alternative is a third-party fairing that would be global; doing
//! it in the handler keeps the check off the other forty-two endpoints, which is what
//! those rows are measured against.

use rocket::data::{Data, Limits, ToByteUnit};
use rocket::http::{ContentType, Header, Status};
use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest};
use rocket::response::{status::Custom, Responder};
use rocket::serde::json::Json;
use rocket::{catch, catchers, get, patch, post, put, delete, routes, Request, Response};
use rb_domain as d;
use serde_json::Value;
use std::io::Cursor;

// ---- shared response shapes ---------------------------------------------------

/// A body plus whatever headers the family needs. Rocket builds responses from a
/// Responder, so the families that set validators or a serial return one of these.
struct Raw {
    status: Status,
    content_type: ContentType,
    body: Vec<u8>,
    headers: Vec<(&'static str, String)>,
}

impl<'r> Responder<'r, 'static> for Raw {
    fn respond_to(self, _: &'r Request<'_>) -> rocket::response::Result<'static> {
        let mut b = Response::build();
        b.status(self.status).header(self.content_type).sized_body(self.body.len(), Cursor::new(self.body));
        for (k, v) in self.headers {
            b.header(Header::new(k, v));
        }
        Ok(b.finalize())
    }
}

fn json_raw<T: serde::Serialize>(v: &T) -> Vec<u8> {
    serde_json::to_vec(v).unwrap_or_default()
}

/// The domain's failures as a Rocket responder. Handlers return `Result` and never build a
/// 404 or a 422 themselves.
type R<T> = Result<T, Custom<Json<Value>>>;

fn fail<T>(e: d::Fail) -> R<T> {
    Err(match e {
        d::Fail::NotFound => Custom(Status::NotFound, Json(d::not_found_body())),
        d::Fail::Invalid(errs) => Custom(Status::UnprocessableEntity, Json(d::invalid_body(&errs))),
    })
}

fn lift<T>(v: Result<T, d::Fail>) -> R<Json<T>> {
    match v {
        Ok(v) => Ok(Json(v)),
        Err(e) => fail(e),
    }
}

async fn body_of(data: Data<'_>) -> R<Value> {
    let bytes = match data.open(8.mebibytes()).into_bytes().await {
        Ok(b) if b.is_complete() => b.into_inner(),
        _ => return fail(d::malformed_body()),
    };
    match serde_json::from_slice(&bytes) {
        Ok(v) => Ok(v),
        Err(_) => fail(d::malformed_body()),
    }
}

// ---- guards -------------------------------------------------------------------

/// The bearer check as a Rocket guard, which is Rocket's per-route facility. Failing the
/// guard hands the 403 to the catcher below, so the body is the same JSON as everywhere.
struct Token;

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Token {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        if d::token_ok(req.headers().get_one("authorization")) {
            Outcome::Success(Token)
        } else {
            Outcome::Error((Status::Forbidden, ()))
        }
    }
}

/// The raw query string, split the way every other language's first-value lookup does.
struct RawQuery(d::Query);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for RawQuery {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        Outcome::Success(RawQuery(d::parse_query(req.uri().query().map_or("", |q| q.as_str()))))
    }
}

/// One middleware layer. Rocket resolves each guard in turn before the handler runs, so a
/// chain of these is the framework doing the same work a layer does elsewhere.
macro_rules! layer {
    ($($name:ident),*) => {$(
        struct $name;
        #[rocket::async_trait]
        impl<'r> FromRequest<'r> for $name {
            type Error = ();
            async fn from_request(_: &'r Request<'_>) -> request::Outcome<Self, ()> {
                Outcome::Success($name)
            }
        }
    )*};
}
layer!(L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15, L16);

// ---- handlers -----------------------------------------------------------------

#[get("/plaintext")]
fn plaintext() -> (ContentType, &'static str) {
    (ContentType::Plain, "Hello, World!")
}

#[get("/health")]
fn health() -> (ContentType, &'static str) {
    (ContentType::Plain, "ok")
}

#[get("/__meta")]
fn meta() -> Json<Value> {
    Json(rb_host::meta("rocket"))
}

#[get("/json/small")]
fn json_small() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}
#[get("/json/medium")]
fn json_medium() -> Json<&'static d::PayloadBody> {
    Json(d::payload("medium"))
}
#[get("/json/large")]
fn json_large() -> Json<&'static d::PayloadBody> {
    Json(d::payload("large"))
}

#[get("/parameters/static/segment/literal")]
fn param_static() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}
#[get("/parameters/<_one>")]
fn param_one(_one: &str) -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}
#[get("/parameters/<_one>/with-second/<_two>")]
fn param_two(_one: &str, _two: &str) -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

#[get("/query/one")]
fn query_one(q: RawQuery) -> Json<d::QueryOne> {
    Json(d::coerce_one(&q.0))
}
#[get("/query/many")]
fn query_many(q: RawQuery) -> Json<d::QueryMany> {
    Json(d::coerce_many(&q.0))
}

/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
#[get("/headers")]
fn headers() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

#[get("/middleware/none")]
fn mw_none() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}
#[get("/middleware/four")]
fn mw_four(_a: L1, _b: L2, _c: L3, _d: L4) -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}
#[allow(clippy::too_many_arguments)]
#[get("/middleware/sixteen")]
fn mw_sixteen(
    _a: L1, _b: L2, _c: L3, _d: L4, _e: L5, _f: L6, _g: L7, _h: L8,
    _i: L9, _j: L10, _k: L11, _l: L12, _m: L13, _n: L14, _o: L15, _p: L16,
) -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

#[get("/authorized/small")]
fn authorized(_t: Token) -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

/// Level pinned across every language. The threshold mirrors what the other targets'
/// middleware defaults to, because whether a framework bothers to compress a body too
/// small to benefit is what compressed.gzip_small is in the set to show.
fn compressed(size: &'static str, accept: Option<&str>) -> Raw {
    let body = json_raw(d::payload(size));
    let wants = accept.is_some_and(|a| a.contains("gzip"));
    let mut headers = vec![("x-rb-serial", d::next_serial())];
    let body = if wants && body.len() > 32 {
        headers.push(("content-encoding", "gzip".to_string()));
        headers.push(("vary", "accept-encoding".to_string()));
        d::gzip(&body)
    } else {
        body
    };
    Raw { status: Status::Ok, content_type: ContentType::JSON, body, headers }
}

#[get("/compressed/small")]
fn comp_small(req: AcceptEncoding) -> Raw {
    compressed("small", req.0.as_deref())
}
#[get("/compressed/medium")]
fn comp_medium(req: AcceptEncoding) -> Raw {
    compressed("medium", req.0.as_deref())
}
#[get("/compressed/large")]
fn comp_large(req: AcceptEncoding) -> Raw {
    compressed("large", req.0.as_deref())
}

struct AcceptEncoding(Option<String>);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AcceptEncoding {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        Outcome::Success(AcceptEncoding(req.headers().get_one("accept-encoding").map(str::to_string)))
    }
}

struct IfNoneMatch(Option<String>);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for IfNoneMatch {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        Outcome::Success(IfNoneMatch(req.headers().get_one("if-none-match").map(str::to_string)))
    }
}

/// The ETag is pinned in the fixture, so what this measures is emitting the header and
/// comparing it rather than hashing a body. The comparison requires a non-empty header:
/// matching a missing if-none-match against an empty ETag answers 304 to a client that
/// never asked a conditional question.
fn cached(size: &'static str, inm: Option<&str>) -> Raw {
    let etag = d::etag_of(size);
    let headers = vec![
        ("etag", etag.to_string()),
        ("cache-control", d::CACHEABLE.to_string()),
        ("x-rb-serial", d::next_serial()),
    ];
    let fresh = inm.is_some_and(|v| !v.is_empty() && v == etag);
    Raw {
        status: if fresh { Status::NotModified } else { Status::Ok },
        content_type: ContentType::JSON,
        body: if fresh { Vec::new() } else { json_raw(d::payload(size)) },
        headers,
    }
}

#[get("/cached/small")]
fn cached_small(h: IfNoneMatch) -> Raw {
    cached("small", h.0.as_deref())
}
#[get("/cached/medium")]
fn cached_medium(h: IfNoneMatch) -> Raw {
    cached("medium", h.0.as_deref())
}
#[get("/cached/large")]
fn cached_large(h: IfNoneMatch) -> Raw {
    cached("large", h.0.as_deref())
}

#[get("/template/small")]
fn tpl_small() -> (ContentType, String) {
    (ContentType::HTML, rb_host::render_items(d::payload("small")))
}
#[get("/template/medium")]
fn tpl_medium() -> (ContentType, String) {
    (ContentType::HTML, rb_host::render_items(d::payload("medium")))
}

// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
#[post("/body/bind/small", data = "<data>")]
async fn bind_small(data: Data<'_>) -> R<Json<d::BindResult>> {
    Ok(Json(d::bind_echo(body_of(data).await?)))
}
#[post("/body/bind/medium", data = "<data>")]
async fn bind_medium(data: Data<'_>) -> R<Json<d::BindResult>> {
    Ok(Json(d::bind_echo(body_of(data).await?)))
}
#[post("/body/validate/small", data = "<data>")]
async fn validate_small(data: Data<'_>) -> R<Json<d::ValidatedOrder>> {
    lift(d::validate_order(&body_of(data).await?, false))
}
#[post("/body/validate/medium", data = "<data>")]
async fn validate_medium(data: Data<'_>) -> R<Json<d::ValidatedOrder>> {
    lift(d::validate_order(&body_of(data).await?, false))
}
#[post("/body/validate/first-error", data = "<data>")]
async fn validate_first(data: Data<'_>) -> R<Json<d::ValidatedOrder>> {
    lift(d::validate_order(&body_of(data).await?, true))
}

#[get("/domain/orders")]
fn filter(q: RawQuery) -> Json<d::OrdersPage> {
    Json(d::domain_filter(&q.0))
}

#[get("/domain/orders/<oid>")]
fn lookup(oid: &str) -> R<Json<&'static d::Order>> {
    lift(d::get_order(oid))
}

#[get("/domain/customers/<cid>/summary")]
fn join(cid: &str) -> R<Json<d::JoinSummary>> {
    lift(d::domain_join(cid))
}

#[get("/domain/regions/<region>/report")]
fn aggregate(region: &str) -> R<Json<d::Report>> {
    lift(d::domain_aggregate(region))
}

#[post("/domain/orders", data = "<data>")]
async fn create(data: Data<'_>) -> R<Raw> {
    let v = match d::validate_order(&body_of(data).await?, false) {
        Ok(v) => v,
        Err(e) => return fail(e),
    };
    Ok(Raw {
        status: Status::Created,
        content_type: ContentType::JSON,
        body: json_raw(&v),
        headers: vec![("location", d::created_location())],
    })
}

#[put("/domain/orders/<oid>", data = "<data>")]
async fn replace(oid: &str, data: Data<'_>) -> R<Json<d::ValidatedOrder>> {
    let existing = match d::get_order(oid) {
        Ok(o) => o.id,
        Err(e) => return fail(e),
    };
    let mut v = match d::validate_order(&body_of(data).await?, false) {
        Ok(v) => v,
        Err(e) => return fail(e),
    };
    v.id = Some(existing);
    Ok(Json(v))
}

#[patch("/domain/customers/<cid>", data = "<data>")]
async fn patch_customer(cid: &str, data: Data<'_>) -> R<Json<d::Customer>> {
    lift(d::patch_customer(cid, &body_of(data).await?))
}

#[delete("/domain/orders/<oid>/lines/<lid>")]
fn delete_line(oid: &str, lid: &str) -> R<Status> {
    match d::get_order_line(oid, lid) {
        Ok(_) => Ok(Status::NoContent),
        Err(e) => fail(e),
    }
}

// ---- catchers -----------------------------------------------------------------

// rb:snippet errors.unmatched
#[catch(404)]
fn catch_404() -> Json<Value> {
    Json(d::not_found_body())
}

#[catch(403)]
fn catch_403() -> Json<Value> {
    Json(d::forbidden_body())
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let port = rb_host::boot("rocket");
    let figment = rocket::Config::figment()
        .merge(("port", port))
        .merge(("address", "0.0.0.0"))
        .merge(("log_level", "off"))
        .merge(("cli_colors", false))
        .merge(("limits", Limits::default().limit("json", 8.mebibytes())));

    rocket::custom(figment)
        .mount(
            "/",
            routes![
                plaintext, health, meta,
                json_small, json_medium, json_large,
                param_static, param_one, param_two,
                query_one, query_many, headers,
                mw_none, mw_four, mw_sixteen, authorized,
                comp_small, comp_medium, comp_large,
                cached_small, cached_medium, cached_large,
                tpl_small, tpl_medium,
                bind_small, bind_medium, validate_small, validate_medium, validate_first,
                filter, lookup, join, aggregate, create, replace, patch_customer, delete_line,
            ],
        )
        .register("/", catchers![catch_404, catch_403])
        .launch()
        .await
        .map(|_| ())
}
