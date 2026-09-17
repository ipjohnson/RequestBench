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
use serde::{Deserialize, Serialize};
use rocket::{catch, catchers, get, patch, post, put, delete, routes, FromForm, Request, Response};
use rb_domain as d;
use serde_json::Value;
use std::io::Cursor;

// ---- shared response shapes ---------------------------------------------------

/// A body plus whatever headers the family needs. Rocket builds responses from a
/// Responder, so the families that set validators or a serial return one of these.
struct Raw {
    status: Status,
    /// None for a status that carries no body. A 304 declaring application/json describes
    /// a body it is not allowed to send.
    content_type: Option<ContentType>,
    body: Vec<u8>,
    headers: Vec<(&'static str, String)>,
}

impl<'r> Responder<'r, 'static> for Raw {
    fn respond_to(self, _: &'r Request<'_>) -> rocket::response::Result<'static> {
        let mut b = Response::build();
        b.status(self.status).sized_body(self.body.len(), Cursor::new(self.body));
        if let Some(ct) = self.content_type {
            b.header(ct);
        }
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
    })
}

// ---- validation: Rocket's typed Json guard, and this target's own rules ---------
//
// `Json<OrderIn>` is a data guard, which is the framework's binding half: Rocket
// deserializes into the struct before the route is called and fails the guard for a body
// that will not fit, without the route seeing it. These routes used to take `Data` and
// call serde_json::from_slice, which made the guard a no-op and the binding this
// repository's rather than Rocket's.
//
// A failed data guard answers 422 with Rocket's own body, and its catchers are what render
// it -- the same catchers the authorized family already leans on for its 403.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because Rocket has no
// validation layer to put them in.

/// The order body as Rocket's guard binds it. serde reports the first field that does not fit.
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
fn validated(order: &OrderIn, first_error: bool) -> Result<d::ValidatedOrder, Custom<Json<Value>>> {
    let errs = check(order, first_error);
    if !errs.is_empty() {
        return Err(Custom(
            Status::UnprocessableEntity,
            Json(serde_json::json!({ "error": "validation_failed", "errors": errs })),
        ));
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Ok(d::price_order(order.customer_id, &order.status, &lines))
}

fn lift<T>(v: Result<T, d::Fail>) -> R<Json<T>> {
    match v {
        Ok(v) => Ok(Json(v)),
        Err(e) => fail(e),
    }
}

/// An unvalidated body, for the endpoints that only parse. The validate routes use the
/// guard; this is only for bind, which is measured against them.
async fn body_of(data: Data<'_>) -> R<Value> {
    let not_bound = |detail: String| {
        Custom(
            Status::BadRequest,
            Json(serde_json::json!({ "error": "invalid_body", "detail": detail })),
        )
    };
    let bytes = match data.open(8.mebibytes()).into_bytes().await {
        Ok(b) if b.is_complete() => b.into_inner(),
        _ => return Err(not_bound("the body was not read in full".to_string())),
    };
    serde_json::from_slice(&bytes).map_err(|e| not_bound(e.to_string()))
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

// ---- query: Rocket's own FromForm query guard ---------------------------------
//
// Rocket binds a query through the route attribute: `?<q..>` names a guard, and the
// derived FromForm parses and types each field before the handler runs. The struct it
// fills is the struct the handler answers.
//
// The fields are plain, so FromForm decides what a missing or unparseable one is, and what
// Rocket answers when a guard does not fit is Rocket's own. The endpoint set sends neither.

#[derive(Serialize, FromForm)]
struct QueryOne {
    page: i64,
}

#[derive(Serialize, FromForm)]
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

/// What domain.filter pages by. Not a response shape, so it derives no Serialize.
#[derive(FromForm)]
struct OrderFilter {
    page: i64,
    size: i64,
    status: String,
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

#[get("/query/one?<q..>")]
fn query_one(q: QueryOne) -> Json<QueryOne> {
    Json(q)
}
#[get("/query/many?<q..>")]
fn query_many(q: QueryMany) -> Json<QueryMany> {
    Json(q)
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
    Raw { status: Status::Ok, content_type: Some(ContentType::JSON), body, headers }
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
        content_type: if fresh { None } else { Some(ContentType::JSON) },
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
#[post("/body/validate/small", data = "<order>")]
fn validate_small(order: Json<OrderIn>) -> R<Json<d::ValidatedOrder>> {
    Ok(Json(validated(&order, false)?))
}
#[post("/body/validate/medium", data = "<order>")]
fn validate_medium(order: Json<OrderIn>) -> R<Json<d::ValidatedOrder>> {
    Ok(Json(validated(&order, false)?))
}
#[post("/body/validate/first-error", data = "<order>")]
fn validate_first(order: Json<OrderIn>) -> R<Json<d::ValidatedOrder>> {
    Ok(Json(validated(&order, true)?))
}

#[get("/domain/orders?<f..>")]
fn filter(f: OrderFilter) -> Json<d::OrdersPage> {
    Json(d::domain_filter(f.page, f.size, &f.status))
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

#[post("/domain/orders", data = "<order>")]
fn create(order: Json<OrderIn>) -> R<Raw> {
    let v = validated(&order, false)?;
    Ok(Raw {
        status: Status::Created,
        content_type: Some(ContentType::JSON),
        body: json_raw(&v),
        headers: vec![("location", d::created_location())],
    })
}

#[put("/domain/orders/<oid>", data = "<order>")]
fn replace(oid: &str, order: Json<OrderIn>) -> R<Json<d::ValidatedOrder>> {
    let existing = match d::get_order(oid) {
        Ok(o) => o.id,
        Err(e) => return fail(e),
    };
    let mut v = validated(&order, false)?;
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

/// A body the Json guard could not deserialize into the struct. Rocket separates the two
/// layers the way axum does -- 422 when the JSON parsed and would not fit the type, 400
/// when it would not parse at all -- and its default for both is an HTML page, so the
/// catchers are what give this target a body of its own.
/// Rocket's status for a guard that parsed but did not fit the type it was asked for,
/// which is both a body the Json guard refused and a query the FromForm guard refused.
/// The catcher sees the status rather than the guard, so the envelope names neither.
#[catch(422)]
fn catch_422() -> Custom<Json<Value>> {
    Custom(
        Status::UnprocessableEntity,
        Json(serde_json::json!({
            "error": "unprocessable",
            "detail": "the request did not fit the target type"
        })),
    )
}

#[catch(400)]
fn catch_400() -> Custom<Json<Value>> {
    Custom(
        Status::BadRequest,
        Json(serde_json::json!({
            "error": "invalid_body",
            "detail": "the body could not be parsed as JSON"
        })),
    )
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
        .register("/", catchers![catch_404, catch_403, catch_422, catch_400])
        .launch()
        .await
        .map(|_| ())
}
