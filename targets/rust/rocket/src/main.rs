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
use rocket::fairing::AdHoc;
use rocket::http::{ContentType, Header, Status};
use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest};
use rocket::response::{status::Custom, Responder};
use rocket::serde::json::Json;
use rocket_dyn_templates::{context, Template};
use serde::{Deserialize, Serialize};
use rocket::{catch, catchers, get, patch, post, put, delete, routes, FromForm, Request, Response};
use rb_domain as d;
use serde_json::Value;
use flate2::{write::GzEncoder, Compression};
use std::io::{Cursor, Write};

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

// ---- shared response shapes ---------------------------------------------------

// rb:wiring compressed.*
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

// rb:wiring errors.*,domain.*
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

// rb:wiring body.*,domain.*
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

// rb:wiring domain.*,errors.*
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

// rb:wiring authorized.*
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
// fills is what the handler echoes beside the small payload.
//
// The fields are plain, so FromForm decides what a missing or unparseable one is, and what
// Rocket answers when a guard does not fit is Rocket's own. The endpoint set sends neither.

// rb:wiring query.*
#[derive(Serialize, FromForm)]
struct QueryOne {
    page: i64,
}

// rb:wiring query.*
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

// ---- parameters and headers: Rocket's typed segments, and a request guard -----
//
// Rocket binds a capture through the route attribute: `<one>` names a segment, and the i64
// argument under it is converted by Rocket's FromParam before the handler runs. A segment
// that is not an integer forwards with 422, which is Rocket's own answer once nothing else
// matches.
//
// Rocket has no header binder. What a route takes from the request beyond its path, query
// and body is a request guard, so the three bound headers are a guard of this target's own.
// It converts the account itself, and a header that is missing or will not convert fails it
// with 422, the status Rocket's own guards answer for a value that does not fit. The
// endpoint set sends neither.

#[derive(Serialize)]
struct ParamOne {
    one: i64,
}

#[derive(Serialize)]
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
#[rocket::async_trait]
impl<'r> FromRequest<'r> for BoundHeaders {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        let text = move |name: &str| req.headers().get_one(name);
        let account = text("x-rb-account").and_then(|v| v.parse().ok());
        match (text("x-rb-tenant"), text("x-rb-request-id"), account) {
            (Some(tenant), Some(request_id), Some(account)) => Outcome::Success(BoundHeaders {
                tenant: tenant.to_string(),
                request_id: request_id.to_string(),
                account,
            }),
            _ => Outcome::Error((Status::UnprocessableEntity, ())),
        }
    }
}

// rb:wiring middleware.*
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
    Json(rb_host::meta("rocket", "serde_json", "tera"))
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
#[get("/parameters/<one>/segment/literal")]
fn param_one(one: i64) -> Json<d::WithEcho<ParamOne>> {
    Json(d::with_echo("small", ParamOne { one }))
}
#[get("/parameters/<one>/with-second/<two>")]
fn param_two(one: i64, two: i64) -> Json<d::WithEcho<ParamTwo>> {
    Json(d::with_echo("small", ParamTwo { one, two }))
}

#[get("/query/one?<q..>")]
fn query_one(q: QueryOne) -> Json<d::WithEcho<QueryOne>> {
    Json(d::with_echo("small", q))
}
#[get("/query/many?<q..>")]
fn query_many(q: QueryMany) -> Json<d::WithEcho<QueryMany>> {
    Json(d::with_echo("small", q))
}

/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 25 nobody asked for.
#[get("/headers")]
fn headers() -> Json<&'static d::PayloadBody> {
    Json(d::payload("small"))
}

#[get("/headers/bind")]
fn headers_bind(h: BoundHeaders) -> Json<d::WithEcho<BoundHeaders>> {
    Json(d::with_echo("small", h))
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

// rb:wiring compressed.*
/// The threshold mirrors what the other targets' middleware defaults to, because whether a
/// framework bothers to compress a body too small to benefit is what compressed.gzip_small
/// is in the set to show.
fn compressed(size: &'static str, accept: Option<&str>) -> Raw {
    let body = json_raw(d::payload(size));
    let wants = accept.is_some_and(|a| a.contains("gzip"));
    let mut headers = vec![("x-rb-serial", d::next_serial())];
    let body = if wants && body.len() > 32 {
        headers.push(("content-encoding", "gzip".to_string()));
        headers.push(("vary", "accept-encoding".to_string()));
        let mut gz = GzEncoder::new(Vec::new(), Compression::fast());
        let _ = gz.write_all(&body);
        gz.finish().unwrap_or_default()
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

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because a route's guard is resolved at compile time and the
/// values are the same constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];

#[rocket::async_trait]
impl<'r, const N: usize> FromRequest<'r> for VaryValue<N> {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, ()> {
        let names = if N == 1 { VARY_ONE } else { VARY_MANY };
        let mut values: [String; N] = std::array::from_fn(|_| String::new());
        for (i, name) in names.iter().enumerate() {
            values[i] = req.headers().get_one(name).unwrap_or("").to_string();
        }
        Outcome::Success(VaryValue(values))
    }
}

// rb:wiring etag.*
/// etag: the digest and the comparison, in a route.
///
/// Rocket ships no conditional handling, so the digest is the shared one and `/__meta` says
/// so. Its fairings are the closest thing it has to middleware and they attach to the whole
/// application rather than to a route, so a fairing here would hash every response in the
/// blend and contaminate the rows this family is measured against. The request guard is
/// what keeps the header out of the route body.
///
/// Shallow, which is the point: the body is serialized and hashed before anything is
/// compared, so the 304 saves the write and nothing else.
fn revalidated(size: &'static str, asked: Option<&str>) -> Raw {
    let raw = json_raw(d::payload(size));
    let etag = d::content_etag(&raw);
    let fresh = asked == Some(etag.as_str());
    let headers = vec![
        ("etag", etag),
        ("cache-control", d::CACHEABLE.to_string()),
        ("x-rb-serial", d::next_serial()),
    ];
    Raw {
        status: if fresh { Status::NotModified } else { Status::Ok },
        content_type: if fresh { None } else { Some(ContentType::JSON) },
        body: if fresh { Vec::new() } else { raw },
        headers,
    }
}

// rb:handler etag.small
#[get("/etag/small")]
fn etag_small(h: IfNoneMatch) -> Raw {
    revalidated("small", h.0.as_deref())
}
// rb:handler etag.large,etag.match_large,etag.stale_large
#[get("/etag/large")]
fn etag_large(h: IfNoneMatch) -> Raw {
    revalidated("large", h.0.as_deref())
}

// rb:wiring cache.*
/// cache: the store consulted before the payload is built.
///
/// Rocket ships no response cache, so the store is the shared LRU sized from the fixture.
/// One store for the target rather than one per route, so the capacity the fixture derives
/// from the key count means what it says. The header values a row varies on arrive through
/// request guards for the same reason the conditional's does.
static CACHE: std::sync::LazyLock<d::ResponseStore> =
    std::sync::LazyLock::new(d::ResponseStore::new);

// rb:wiring cache.*
fn replayed(size: &'static str, path: &str, on: &[&str], values: Vec<String>) -> Raw {
    let key = d::cache_key(path, &values);
    let hit = CACHE.get(&key).unwrap_or_else(|| {
        let mut headers = vec![("x-rb-serial".to_string(), d::next_serial())];
        if !on.is_empty() {
            headers.push(("vary".to_string(), on.join(", ")));
        }
        let fresh = d::StoredResponse {
            status: 200,
            headers,
            body: json_raw(d::payload(size)),
        };
        CACHE.put(key, fresh.clone());
        fresh
    });
    Raw {
        status: Status::Ok,
        content_type: Some(ContentType::JSON),
        body: hit.body,
        headers: hit
            .headers
            .into_iter()
            .map(|(n, v)| (Box::leak(n.into_boxed_str()) as &'static str, v))
            .collect(),
    }
}

/// One header value a vary row is keyed on. A guard rather than a parameter, because that
/// is how Rocket gets a header to a route without the route reading one.
struct VaryValue<const N: usize>([String; N]);

// rb:handler cache.small,cache.medium,cache.large
#[get("/cache/small")]
fn cache_small() -> Raw {
    replayed("small", "/cache/small", &[], Vec::new())
}
#[get("/cache/medium")]
fn cache_medium() -> Raw {
    replayed("medium", "/cache/medium", &[], Vec::new())
}
#[get("/cache/large")]
fn cache_large() -> Raw {
    replayed("large", "/cache/large", &[], Vec::new())
}

// rb:handler cache.vary_one,cache.vary_many
#[get("/cache/vary/one")]
fn cache_vary_one(v: VaryValue<1>) -> Raw {
    replayed("small", "/cache/vary/one", VARY_ONE, v.0.to_vec())
}
#[get("/cache/vary/many")]
fn cache_vary_many(v: VaryValue<3>) -> Raw {
    replayed("small", "/cache/vary/many", VARY_MANY, v.0.to_vec())
}

// template: server-side rendering of the same model the json family serializes.
//
// Rocket's own view facility: rocket_dyn_templates, mounted as a fairing, with
// Template::render naming a file. It is the one Rust target here with a view layer, and
// the engine follows from the file extension: .tera is Tera, which is what Rocket's guide
// and its own templating example use. Parsed at launch and rendered per request, so a
// precomputed string would measure nothing.
//
// The templates are read from disk rather than compiled in, which is what
// rocket_dyn_templates does. ROCKET_TEMPLATE_DIR is where the container image puts them;
// without it Rocket looks beside the crate, which is right for MODE=local.
#[get("/template/small")]
fn tpl_small() -> Template {
    Template::render("items", context! { body: d::payload("small") })
}
#[get("/template/medium")]
fn tpl_medium() -> Template {
    Template::render("items", context! { body: d::payload("medium") })
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

// rb:handler errors.unmatched
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

#[cfg(test)]
mod suite;

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let port = rb_host::boot("rocket");
    rocket(port)
        // Liftoff runs once Rocket has bound its listener, just before it serves on it.
        .attach(AdHoc::on_liftoff("rb-host", |_| Box::pin(async { rb_host::listening() })))
        .launch()
        .await
        .map(|_| ())
}

/// Every route, on a Rocket nothing is serving yet. Its own function so a test can hand it
/// requests: built inline in main(), the only way to reach it was to start this target on
/// its container port. main() serves what it returns.
fn rocket(port: u16) -> rocket::Rocket<rocket::Build> {
    // rocket_dyn_templates resolves template_dir against the working directory, which under
    // MODE=local is the repo root rather than this crate. The compile-time default points at
    // the crate's own templates; the container sets ROCKET_TEMPLATE_DIR to where the image
    // put them.
    let template_dir = std::env::var("ROCKET_TEMPLATE_DIR")
        .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/templates").to_string());
    let figment = rocket::Config::figment()
        .merge(("template_dir", template_dir))
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
                query_one, query_many, headers, headers_bind,
                mw_none, mw_four, mw_sixteen, authorized,
                comp_small, comp_medium, comp_large,
                etag_small, etag_large,
                cache_small, cache_medium, cache_large,
                cache_vary_one, cache_vary_many,
                tpl_small, tpl_medium,
                bind_small, bind_medium, validate_small, validate_medium, validate_first,
                filter, lookup, join, aggregate, create, replace, patch_customer, delete_line,
            ],
        )
        // rb:wiring template.*
        .attach(Template::fairing())
        .register("/", catchers![catch_404, catch_403, catch_422, catch_400])
}
