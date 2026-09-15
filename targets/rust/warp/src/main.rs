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
use serde::Serialize;
use serde_json::Value;
use warp::http::{header, StatusCode};
use warp::reply::Response;
use warp::{Filter, Reply};

type Route = warp::filters::BoxedFilter<(Response,)>;

fn json<T: Serialize>(v: &T) -> Response {
    warp::reply::json(v).into_response()
}

/// Maps the domain's failures onto statuses, so no arm builds a 404 or a 422 itself.
fn fail(e: d::Fail) -> Response {
    match e {
        d::Fail::NotFound => {
            warp::reply::with_status(warp::reply::json(&d::not_found_body()), StatusCode::NOT_FOUND)
                .into_response()
        }
        d::Fail::Invalid(errs) => warp::reply::with_status(
            warp::reply::json(&d::invalid_body(&errs)),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .into_response(),
    }
}

fn ok<T: Serialize>(v: Result<T, d::Fail>) -> Response {
    match v {
        Ok(v) => json(&v),
        Err(e) => fail(e),
    }
}

fn parse(b: &Bytes) -> Result<Value, d::Fail> {
    serde_json::from_slice(b).map_err(|_| d::malformed_body())
}

/// The raw query string. `warp::query::raw` rejects when there is none, and every other
/// language's lookup simply finds nothing, so the empty case is supplied.
fn raw_query() -> impl Filter<Extract = (String,), Error = std::convert::Infallible> + Clone {
    warp::query::raw().or(warp::any().map(String::new)).unify()
}

/// One layer: a filter that runs in the chain and extracts nothing. Boxing between them is
/// what keeps sixteen from becoming a type rustc spends minutes on.
fn layered(n: usize, f: Route) -> Route {
    (0..n).fold(f, |acc, _| warp::any().and(acc).boxed())
}

fn payload_route(size: &'static str) -> Route {
    warp::path!("json" / String)
        .and(warp::get())
        .and_then(move |s: String| async move {
            if s == size { Ok(json(d::payload(size))) } else { Err(warp::reject::not_found()) }
        })
        .boxed()
}

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

#[tokio::main]
async fn main() {
    let port = rb_host::boot("warp");

    let small = || json(d::payload("small"));

    // rb:snippet baseline.plaintext
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
        .or(warp::path!("__meta").and(warp::get()).map(|| json(&rb_host::meta("warp"))))
        .unify()
        .boxed();

    // Static routes, not /json/<size>: the size set is fixed, so a capture would answer
    // 200 with an empty body for a size that does not exist. warp matches a segment, so
    // the arm checks the literal and rejects anything else on to the next filter.
    // rb:snippet json.small json.medium json.large
    let sizes = payload_route("small")
        .or(payload_route("medium"))
        .unify()
        .or(payload_route("large"))
        .unify()
        .boxed();

    // rb:snippet parameters.static parameters.one parameters.two
    let params = warp::path!("parameters" / "static" / "segment" / "literal")
        .and(warp::get())
        .map(small)
        .or(warp::path!("parameters" / String / "with-second" / String)
            .and(warp::get())
            .map(move |_a: String, _b: String| small()))
        .unify()
        .or(warp::path!("parameters" / String).and(warp::get()).map(move |_a: String| small()))
        .unify()
        .boxed();

    // rb:snippet query.one query.many headers.few headers.many
    let queries = warp::path!("query" / "one")
        .and(warp::get())
        .and(raw_query())
        .map(|q: String| json(&d::coerce_one(&d::parse_query(&q))))
        .or(warp::path!("query" / "many")
            .and(warp::get())
            .and(raw_query())
            .map(|q: String| json(&d::coerce_many(&d::parse_query(&q)))))
        .unify()
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 27 nobody asked for.
        .or(warp::path!("headers").and(warp::get()).map(small))
        .unify()
        .boxed();

    // rb:snippet middleware.none middleware.four middleware.sixteen
    let mw = warp::path!("middleware" / "none")
        .and(warp::get())
        .map(small)
        .boxed()
        .or(layered(4, warp::path!("middleware" / "four").and(warp::get()).map(small).boxed()))
        .unify()
        .or(layered(16, warp::path!("middleware" / "sixteen").and(warp::get()).map(small).boxed()))
        .unify()
        .boxed();

    // A filter, not an `if` in the handler: the point of the authorized family is the
    // framework's own plumbing.
    // rb:snippet authorized.allowed authorized.denied
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

    // Level is warp's own default, which is the same 6 every other target pins. The size
    // threshold is left alone, because whether a framework bothers to compress a body too
    // small to benefit is what compressed.gzip_small is in the set to show.
    //
    // warp::compression::gzip() compresses whatever it wraps and never reads
    // accept-encoding, so asking for identity got gzip back and compressed.identity_*
    // measured nothing it was supposed to. The negotiation is a filter instead, which is
    // how warp composes anything else: the gzip branch requires the header and rejects
    // without it, and the rejection falls through to the branch that does not compress.
    // rb:snippet compressed.identity_small compressed.identity_medium
    // rb:snippet compressed.identity_large compressed.gzip_small compressed.gzip_medium
    // rb:snippet compressed.gzip_large
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

    // The ETag is pinned in the fixture, so what this measures is emitting the header and
    // comparing it rather than hashing a body. The comparison requires a non-empty header.
    // rb:snippet cached.small cached.medium cached.large cached.revalidate
    let cached = warp::path!("cached" / String)
        .and(warp::get())
        .and(warp::header::optional::<String>("if-none-match"))
        .and_then(|s: String, inm: Option<String>| async move {
            if !matches!(s.as_str(), "small" | "medium" | "large") {
                return Err(warp::reject::not_found());
            }
            let etag = d::etag_of(&s);
            let fresh = inm.as_deref().is_some_and(|v| !v.is_empty() && v == etag);
            let body = if fresh {
                warp::reply::with_status(warp::reply::reply(), StatusCode::NOT_MODIFIED)
                    .into_response()
            } else {
                json(d::payload(&s))
            };
            let mut res = body;
            let h = res.headers_mut();
            h.insert(header::ETAG, etag.parse().expect("etag"));
            h.insert(header::CACHE_CONTROL, d::CACHEABLE.parse().expect("cache-control"));
            h.insert("x-rb-serial", d::next_serial().parse().expect("serial"));
            Ok::<_, warp::Rejection>(res)
        })
        .boxed();

    // rb:snippet template.small template.medium
    let template = warp::path!("template" / String)
        .and(warp::get())
        .and_then(|s: String| async move {
            if !matches!(s.as_str(), "small" | "medium") {
                return Err(warp::reject::not_found());
            }
            Ok::<_, warp::Rejection>(
                warp::reply::with_header(
                    rb_host::render_items(d::payload(&s)),
                    header::CONTENT_TYPE,
                    "text/html; charset=utf-8",
                )
                .into_response(),
            )
        })
        .boxed();

    // bind parses and binds without validating, so validate minus bind is the validator
    // alone rather than the validator plus the parse.
    // rb:snippet body.bind_small body.bind_medium body.validate_small body.validate_medium
    // rb:snippet body.rejected_all body.rejected_first errors.malformed
    let bodies = warp::path!("body" / "bind" / String)
        .and(warp::post())
        .and(warp::body::bytes())
        .map(|_s: String, b: Bytes| match parse(&b) {
            Ok(v) => json(&d::bind_echo(v)),
            Err(e) => fail(e),
        })
        .or(warp::path!("body" / "validate" / "first-error")
            .and(warp::post())
            .and(warp::body::bytes())
            .map(|b: Bytes| ok(parse(&b).and_then(|v| d::validate_order(&v, true)))))
        .unify()
        .or(warp::path!("body" / "validate" / String)
            .and(warp::post())
            .and(warp::body::bytes())
            .map(|_s: String, b: Bytes| ok(parse(&b).and_then(|v| d::validate_order(&v, false)))))
        .unify()
        .boxed();

    // rb:snippet domain.filter domain.create domain.lookup domain.replace domain.delete
    // rb:snippet domain.join domain.patch domain.aggregate errors.not_found
    let domain = warp::path!("domain" / "orders")
        .and(warp::get())
        .and(raw_query())
        .map(|q: String| json(&d::domain_filter(&d::parse_query(&q))))
        .or(warp::path!("domain" / "orders")
            .and(warp::post())
            .and(warp::body::bytes())
            .map(|b: Bytes| match parse(&b).and_then(|v| d::validate_order(&v, false)) {
                Ok(v) => warp::reply::with_header(
                    warp::reply::with_status(warp::reply::json(&v), StatusCode::CREATED),
                    header::LOCATION,
                    d::created_location(),
                )
                .into_response(),
                Err(e) => fail(e),
            }))
        .unify()
        .or(warp::path!("domain" / "orders" / String)
            .and(warp::get())
            .map(|oid: String| ok(d::get_order(&oid))))
        .unify()
        .or(warp::path!("domain" / "orders" / String)
            .and(warp::put())
            .and(warp::body::bytes())
            .map(|oid: String, b: Bytes| {
                let id = match d::get_order(&oid) {
                    Ok(o) => o.id,
                    Err(e) => return fail(e),
                };
                match parse(&b).and_then(|v| d::validate_order(&v, false)) {
                    Ok(mut v) => {
                        v.id = Some(id);
                        json(&v)
                    }
                    Err(e) => fail(e),
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
            .map(|cid: String, b: Bytes| ok(parse(&b).and_then(|v| d::patch_customer(&cid, &v)))))
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
        .or(cached).unify()
        .or(template).unify()
        .or(bodies).unify()
        .or(domain).unify()
        // Every route warp rejected. Its own rejection page is plain text, and every other
        // target answers the same JSON.
        // rb:snippet errors.unmatched
        .or(warp::any().map(|| {
            warp::reply::with_status(
                warp::reply::json(&d::not_found_body()),
                StatusCode::NOT_FOUND,
            )
            .into_response()
        }))
        .unify();

    warp::serve(routes).run(([0, 0, 0, 0], port)).await;
}
