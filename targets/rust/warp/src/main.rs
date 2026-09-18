//! RequestBench target: warp. Framework wiring only; behaviour from rb-domain.
//!
//! warp composes filters rather than registering routes against a table, so a "layer" here
//! is another filter in the chain and a route's guards are filters it is `and`ed with.
//! Every route is boxed to one `Response` so the forty-five arms compose without the type
//! growing past what rustc will finish.
//!
//! Compression is applied to the compressed routes alone: wrapping the whole service would
//! put a "did the client ask?" check on all forty-five endpoints and contaminate the rows
//! that family is measured against.

use bytes::Bytes;
use rb_domain as d;

/// The header names the vary rows are keyed on, as the fixture pins them. Written out here
/// rather than read from it, because a filter takes a &'static and the values are the same
/// constants harness/make_fixture.py asserts the key count from.
const VARY_ONE: &[&str] = &["x-rb-tenant"];
const VARY_MANY: &[&str] = &["x-rb-channel", "x-rb-region", "x-rb-tenant"];

// rb:wiring cache.*
/// One store for the target, sized from the fixture.
static CACHE: std::sync::LazyLock<d::ResponseStore> =
    std::sync::LazyLock::new(d::ResponseStore::new);

// rb:wiring cache.*
/// The stored response for one key, built and stored on the first ask.
fn replayed(path: &str, size: &str, on: &[&str], values: Vec<String>) -> Response {
    let key = d::cache_key(path, &values);
    let hit = CACHE.get(&key).unwrap_or_else(|| {
        let mut headers = vec![("x-rb-serial".to_string(), d::next_serial())];
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
    });
    let mut res =
        warp::reply::with_header(hit.body, header::CONTENT_TYPE, "application/json")
            .into_response();
    let h = res.headers_mut();
    for (name, value) in hit.headers {
        if let (Ok(n), Ok(v)) = (name.parse::<header::HeaderName>(), value.parse()) {
            h.insert(n, v);
        }
    }
    res
}
use serde::Serialize;
use serde::Deserialize;
use serde_json::Value;
use warp::http::{header, StatusCode};
use warp::reply::Response;
use warp::{Filter, Reply};

type Route = warp::filters::BoxedFilter<(Response,)>;

// rb:wiring json.*,parameters.*,query.*,headers.*,middleware.*,authorized.*,template.*
fn json<T: Serialize>(v: &T) -> Response {
    warp::reply::json(v).into_response()
}

// rb:wiring errors.*,domain.*
/// Maps the domain's failures onto statuses, so no arm builds a 404 or a 422 itself.
fn fail(e: d::Fail) -> Response {
    match e {
        d::Fail::NotFound => {
            warp::reply::with_status(warp::reply::json(&d::not_found_body()), StatusCode::NOT_FOUND)
                .into_response()
        }
    }
}

// ---- validation: warp's json body filter, and this target's own rules ----------
//
// `warp::body::json::<OrderIn>()` is the framework's binding half: warp deserializes into
// the struct as part of the filter chain and rejects a body that will not fit before the
// handler runs, through its own `BodyDeserializeError`. These routes used to take
// `body::bytes()` and call serde_json::from_slice, which made the filter a no-op and the
// binding this repository's rather than warp's.
//
// A rejected filter is answered by the recover handler at the end of the chain, which is
// where warp puts every rejection, so that is where the envelope for one lives.
//
// What serde cannot express is the rest: a list needs at least one entry and a qty at
// least one. Those are checked here, in this target's own code, because warp has no
// validation layer to put them in.

// rb:wiring body.*,domain.*
/// The order body as warp's filter binds it. serde reports the first field that does not fit.
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
/// The order as a response, or this target's own answer when its checks refuse the body.
fn validated(order: &OrderIn, first_error: bool) -> Result<d::ValidatedOrder, Response> {
    let errs = check(order, first_error);
    if !errs.is_empty() {
        return Err(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "error": "validation_failed", "errors": errs
            })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .into_response());
    }
    let lines: Vec<d::LineInput> = order
        .lines
        .iter()
        .map(|l| d::LineInput { product_id: l.product_id, qty: l.qty })
        .collect();
    Ok(d::price_order(order.customer_id, &order.status, &lines))
}

// rb:wiring domain.*,errors.*
fn ok<T: Serialize>(v: Result<T, d::Fail>) -> Response {
    match v {
        Ok(v) => json(&v),
        Err(e) => fail(e),
    }
}

// rb:wiring body.*,domain.*
/// An unvalidated body, for the endpoints that only parse. The validate routes use the
/// filter; this is only for bind, which is measured against them.
fn parse(b: &Bytes) -> Result<Value, Response> {
    serde_json::from_slice(b).map_err(|e: serde_json::Error| {
        warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "error": "invalid_body", "detail": e.to_string()
            })),
            StatusCode::BAD_REQUEST,
        )
        .into_response()
    })
}

// ---- query: warp's typed query filter -----------------------------------------
//
// `warp::query::<T>()` is the framework's binding half, the same shape as
// `warp::body::json::<T>()` on the body: it is a filter in the chain that deserializes the
// query string into the struct and rejects what will not fit before the handler runs. The
// struct it fills is the struct the handler answers.
//
// The fields are plain, so serde decides what a missing or unparseable one is: an
// InvalidQuery rejection, which warp renders as its own 400. The endpoint set sends
// neither.

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

// ---- parameters and headers: warp's typed path! and header filters ------------
//
// Both bind in the filter chain before the closure runs. path! converts each capture with
// FromStr, so a segment that is not an integer rejects the route, and "static" never
// reaches the capture beside it. `warp::header::<T>` converts a header the same way, so the
// account arrives as an integer, and a header that is missing or will not convert is warp's
// own rejection. The endpoint set sends neither. These structs are only the echo.

// rb:wiring parameters.*
#[derive(Serialize)]
struct ParamOne {
    one: i64,
}

// rb:wiring parameters.*
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

// rb:wiring middleware.*
/// One layer: a filter that runs in the chain and extracts nothing. Boxing between them is
/// what keeps sixteen from becoming a type rustc spends minutes on.
fn layered(n: usize, f: Route) -> Route {
    (0..n).fold(f, |acc, _| warp::any().and(acc).boxed())
}

// rb:wiring json.*
fn payload_route(size: &'static str) -> Route {
    warp::path!("json" / String)
        .and(warp::get())
        .and_then(move |s: String| async move {
            if s == size { Ok(json(d::payload(size))) } else { Err(warp::reject::not_found()) }
        })
        .boxed()
}

// rb:wiring compressed.*
/// The compressed family's reply, shared by the branch that compresses and the branch that
/// does not. Only the wrapper differs between them.
fn compressed_reply(size: String) -> Result<warp::reply::Response, warp::Rejection> {
    match size.as_str() {
        "small" | "medium" | "large" => Ok(warp::reply::with_header(
            warp::reply::json(d::payload(&size)),
            "x-rb-serial",
            d::next_serial(),
        )
        .into_response()),
        _ => Err(warp::reject::not_found()),
    }
}

// rb:wiring template.*
// ---- template ------------------------------------------------------------------
//
// warp ships no view layer and recommends no engine. Askama is the compile-time
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

#[cfg(test)]
mod suite;

#[tokio::main]
async fn main() {
    let port = rb_host::boot("warp");
    // run() is bind_ephemeral() and an await, and the socket is bound before the await.
    let (_, server) = warp::serve(routes()).bind_ephemeral(([0, 0, 0, 0], port));
    rb_host::listening();
    server.await;
}

/// Every route, on a filter nothing is serving yet. Its own function so a test can hand it
/// requests: built inline in main(), the only way to reach it was to start this target on
/// its container port. main() serves what it returns.
fn routes() -> impl warp::Filter<Extract = (impl warp::Reply,), Error = std::convert::Infallible>
       + Clone + Send + Sync + 'static {
    // rb:wiring parameters.*,query.*,headers.*,middleware.*,authorized.*
    let small = || json(d::payload("small"));

    // rb:handler baseline.*
    let base = warp::path!("plaintext")
        .and(warp::get())
        .map(|| {
            warp::reply::with_header(
                "Hello, World!",
                header::CONTENT_TYPE,
                "text/plain; charset=utf-8",
            )
            .into_response()
        })
        .or(warp::path!("health").and(warp::get()).map(|| {
            warp::reply::with_header("ok", header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .into_response()
        }))
        .unify()
        .or(warp::path!("__meta").and(warp::get()).map(|| json(&rb_host::meta("warp", "askama"))))
        .unify()
        .boxed();

    // rb:handler json.*
    // Static routes, not /json/<size>: the size set is fixed, so a capture would answer
    // 200 with an empty body for a size that does not exist. warp matches a segment, so
    // the arm checks the literal and rejects anything else on to the next filter.
    let sizes = payload_route("small")
        .or(payload_route("medium"))
        .unify()
        .or(payload_route("large"))
        .unify()
        .boxed();

    // rb:handler parameters.*
    let params = warp::path!("parameters" / "static" / "segment" / "literal")
        .and(warp::get())
        .map(small)
        .or(warp::path!("parameters" / i64 / "segment" / "literal")
            .and(warp::get())
            .map(|one: i64| json(&d::with_echo("small", ParamOne { one }))))
        .unify()
        .or(warp::path!("parameters" / i64 / "with-second" / i64)
            .and(warp::get())
            .map(|one: i64, two: i64| json(&d::with_echo("small", ParamTwo { one, two }))))
        .unify()
        .boxed();

    // rb:handler query.*,headers.*
    let queries = warp::path!("query" / "one")
        .and(warp::get())
        .and(warp::query::<QueryOne>())
        .map(|q: QueryOne| json(&q))
        .or(warp::path!("query" / "many")
            .and(warp::get())
            .and(warp::query::<QueryMany>())
            .map(|q: QueryMany| json(&q)))
        .unify()
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 25 nobody asked for.
        .or(warp::path!("headers").and(warp::get()).map(small))
        .unify()
        .or(warp::path!("headers" / "bind")
            .and(warp::get())
            .and(warp::header::<String>("x-rb-tenant"))
            .and(warp::header::<String>("x-rb-request-id"))
            .and(warp::header::<i64>("x-rb-account"))
            .map(|tenant, request_id, account| {
                json(&d::with_echo("small", BoundHeaders { tenant, request_id, account }))
            }))
        .unify()
        .boxed();

    // rb:handler middleware.*
    let mw = warp::path!("middleware" / "none")
        .and(warp::get())
        .map(small)
        .boxed()
        .or(layered(4, warp::path!("middleware" / "four").and(warp::get()).map(small).boxed()))
        .unify()
        .or(layered(16, warp::path!("middleware" / "sixteen").and(warp::get()).map(small).boxed()))
        .unify()
        .boxed();

    // rb:handler authorized.*
    // A filter, not an `if` in the handler: the point of the authorized family is the
    // framework's own plumbing.
    let auth = warp::path!("authorized" / "small")
        .and(warp::get())
        .and(warp::header::optional::<String>("authorization"))
        .map(|h: Option<String>| {
            if d::token_ok(h.as_deref()) {
                json(d::payload("small"))
            } else {
                warp::reply::with_status(
                    warp::reply::json(&d::forbidden_body()),
                    StatusCode::FORBIDDEN,
                )
                .into_response()
            }
        })
        .boxed();

    // rb:handler compressed.*
    // Level is warp's own default, which is the same 6 every other target pins. The size
    // threshold is left alone, because whether a framework bothers to compress a body too
    // small to benefit is what compressed.gzip_small is in the set to show.
    //
    // warp::compression::gzip() compresses whatever it wraps and never reads
    // accept-encoding, so asking for identity got gzip back and compressed.identity_*
    // measured nothing it was supposed to. The negotiation is a filter instead, which is
    // how warp composes anything else: the gzip branch requires the header and rejects
    // without it, and the rejection falls through to the branch that does not compress.
    let compressed_payload = warp::path!("compressed" / String).and(warp::get());

    let wants_gzip = warp::header::optional::<String>("accept-encoding").and_then(
        |v: Option<String>| async move {
            if v.unwrap_or_default().contains("gzip") {
                Ok(())
            } else {
                Err(warp::reject::reject())
            }
        },
    );

    let compressed = compressed_payload
        .clone()
        .and(wants_gzip)
        .and_then(|s: String, _| async move { compressed_reply(s) })
        .with(warp::compression::gzip())
        .map(Reply::into_response)
        .or(compressed_payload.and_then(|s: String| async move { compressed_reply(s) }))
        .unify()
        .map(Reply::into_response)
        .boxed();

    // rb:handler etag.*
    // etag: the digest and the comparison, inside the filter.
    //
    // warp ships no conditional handling, so the digest is the shared one and /__meta says
    // so. A filter is warp's unit of composition and there is nothing that can rewrite a
    // reply after one has produced it, so the conditional is part of the filter chain that
    // answers rather than a wrapper around it.
    //
    // Shallow, which is the point: the body is serialized and hashed before anything is
    // compared, so the 304 saves the write and nothing else.
    let etag = warp::path!("etag" / String)
        .and(warp::get())
        .and(warp::header::optional::<String>("if-none-match"))
        .and_then(|s: String, asked: Option<String>| async move {
            if !matches!(s.as_str(), "small" | "large") {
                return Err(warp::reject::not_found());
            }
            let raw = serde_json::to_vec(d::payload(&s)).unwrap_or_default();
            let tag = d::content_etag(&raw);
            let mut res = if asked.as_deref() == Some(tag.as_str()) {
                warp::reply::with_status(warp::reply::reply(), StatusCode::NOT_MODIFIED)
                    .into_response()
            } else {
                warp::reply::with_header(raw, header::CONTENT_TYPE, "application/json")
                    .into_response()
            };
            let h = res.headers_mut();
            h.insert(header::ETAG, tag.parse().expect("etag"));
            h.insert(header::CACHE_CONTROL, d::CACHEABLE.parse().expect("cache-control"));
            h.insert("x-rb-serial", d::next_serial().parse().expect("serial"));
            Ok::<_, warp::Rejection>(res)
        })
        .boxed();

    // rb:handler cache.small,cache.medium,cache.large
    // cache: the store consulted before the payload is built.
    //
    // warp ships no response cache, so the store is the shared LRU sized from the fixture.
    // One store for the target rather than one per route, so the capacity the fixture
    // derives from the key count means what it says.
    let cache_by_path = warp::path!("cache" / String)
        .and(warp::get())
        .and_then(|s: String| async move {
            if !matches!(s.as_str(), "small" | "medium" | "large") {
                return Err(warp::reject::not_found());
            }
            Ok::<_, warp::Rejection>(replayed(&format!("/cache/{s}"), &s, &[], Vec::new()))
        })
        .boxed();

    // rb:handler cache.vary_one,cache.vary_many
    let cache_vary = warp::path!("cache" / "vary" / String)
        .and(warp::get())
        .and(warp::header::headers_cloned())
        .and_then(|which: String, headers: header::HeaderMap| async move {
            let on: &[&str] = match which.as_str() {
                "one" => VARY_ONE,
                "many" => VARY_MANY,
                _ => return Err(warp::reject::not_found()),
            };
            let values = on
                .iter()
                .map(|name| {
                    headers.get(*name).and_then(|v| v.to_str().ok()).unwrap_or("").to_string()
                })
                .collect();
            Ok::<_, warp::Rejection>(replayed(
                &format!("/cache/vary/{which}"),
                "small",
                on,
                values,
            ))
        })
        .boxed();

    // rb:handler template.*
    let template = warp::path!("template" / String)
        .and(warp::get())
        .and_then(|s: String| async move {
            if !matches!(s.as_str(), "small" | "medium") {
                return Err(warp::reject::not_found());
            }
            Ok::<_, warp::Rejection>(
                warp::reply::with_header(
                    items_html(if s == "small" { "small" } else { "medium" }),
                    header::CONTENT_TYPE,
                    "text/html; charset=utf-8",
                )
                .into_response(),
            )
        })
        .boxed();

    // rb:handler body.*,errors.malformed
    // bind parses and binds without validating, so validate minus bind is the validator
    // alone rather than the validator plus the parse.
    let bodies = warp::path!("body" / "bind" / String)
        .and(warp::post())
        .and(warp::body::bytes())
        .map(|_s: String, b: Bytes| match parse(&b) {
            Ok(v) => json(&d::bind_echo(v)),
            Err(r) => r,
        })
        .or(warp::path!("body" / "validate" / "first-error")
            .and(warp::post())
            .and(warp::body::json())
            .map(|order: OrderIn| match validated(&order, true) {
                Ok(v) => json(&v),
                Err(r) => r,
            }))
        .unify()
        .or(warp::path!("body" / "validate" / String)
            .and(warp::post())
            .and(warp::body::json())
            .map(|_s: String, order: OrderIn| match validated(&order, false) {
                Ok(v) => json(&v),
                Err(r) => r,
            }))
        .unify()
        .boxed();

    // rb:handler domain.*,errors.not_found
    let domain = warp::path!("domain" / "orders")
        .and(warp::get())
        .and(warp::query::<OrderFilter>())
        .map(|f: OrderFilter| json(&d::domain_filter(f.page, f.size, &f.status)))
        .or(warp::path!("domain" / "orders")
            .and(warp::post())
            .and(warp::body::json())
            .map(|order: OrderIn| match validated(&order, false) {
                Ok(v) => warp::reply::with_header(
                    warp::reply::with_status(warp::reply::json(&v), StatusCode::CREATED),
                    header::LOCATION,
                    d::created_location(),
                )
                .into_response(),
                Err(r) => r,
            }))
        .unify()
        .or(warp::path!("domain" / "orders" / String)
            .and(warp::get())
            .map(|oid: String| ok(d::get_order(&oid))))
        .unify()
        .or(warp::path!("domain" / "orders" / String)
            .and(warp::put())
            .and(warp::body::json())
            .map(|oid: String, order: OrderIn| {
                let id = match d::get_order(&oid) {
                    Ok(o) => o.id,
                    Err(e) => return fail(e),
                };
                match validated(&order, false) {
                    Ok(mut v) => {
                        v.id = Some(id);
                        json(&v)
                    }
                    Err(r) => r,
                }
            }))
        .unify()
        .boxed()
        .or(warp::path!("domain" / "orders" / String / "lines" / String)
            .and(warp::delete())
            .map(|oid: String, lid: String| match d::get_order_line(&oid, &lid) {
                Ok(_) => warp::reply::with_status(warp::reply::reply(), StatusCode::NO_CONTENT)
                    .into_response(),
                Err(e) => fail(e),
            }))
        .unify()
        .or(warp::path!("domain" / "customers" / String / "summary")
            .and(warp::get())
            .map(|cid: String| ok(d::domain_join(&cid))))
        .unify()
        .or(warp::path!("domain" / "customers" / String)
            .and(warp::patch())
            .and(warp::body::bytes())
            .map(|cid: String, b: Bytes| match parse(&b) {
                Ok(v) => ok(d::patch_customer(&cid, &v)),
                Err(r) => r,
            }))
        .unify()
        .or(warp::path!("domain" / "regions" / String / "report")
            .and(warp::get())
            .map(|r: String| ok(d::domain_aggregate(&r))))
        .unify()
        .boxed();

    let routes = base
        .or(sizes).unify()
        .or(params).unify()
        .or(queries).unify()
        .or(mw).unify()
        .or(auth).unify()
        .or(compressed).unify()
        .or(etag).unify()
        .or(cache_vary).unify()
        .or(cache_by_path).unify()
        .or(template).unify()
        .or(bodies).unify()
        .or(domain).unify()
        // Every rejection warp raised, answered where warp puts them: .recover is the
        // framework's own hook, and it is the only place that can tell a body the json
        // filter refused from a path nothing matched. An `any()` fallthrough cannot -- both
        // arrive as "no route took this" -- which is why a refused body used to answer 404.
        // rb:handler errors.unmatched
        .recover(|rejection: warp::Rejection| async move {
            if let Some(e) = rejection.find::<warp::filters::body::BodyDeserializeError>() {
                // warp does not separate a body that is not JSON from one of the wrong
                // shape: BodyDeserializeError is both, and 400 is its status for either.
                return Ok::<_, std::convert::Infallible>(
                    warp::reply::with_status(
                        warp::reply::json(&serde_json::json!({
                            "error": "invalid_body", "detail": e.to_string()
                        })),
                        StatusCode::BAD_REQUEST,
                    )
                    .into_response(),
                );
            }
            if let Some(e) = rejection.find::<warp::reject::InvalidQuery>() {
                // The query filter refused. Same shape as the body above: warp raises its
                // own rejection and 400 is its status for one, and without this arm it
                // would arrive here indistinguishable from a path nothing matched.
                return Ok(warp::reply::with_status(
                    warp::reply::json(&serde_json::json!({
                        "error": "invalid_query", "detail": e.to_string()
                    })),
                    StatusCode::BAD_REQUEST,
                )
                .into_response());
            }
            Ok(warp::reply::with_status(
                warp::reply::json(&d::not_found_body()),
                StatusCode::NOT_FOUND,
            )
            .into_response())
        });
    routes
}
