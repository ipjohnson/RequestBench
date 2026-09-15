//! RequestBench target: salvo. Framework wiring only; behaviour from rb-domain.
//!
//! Every feature family uses salvo's own facility rather than an `if` in the handler, and
//! each one is hooped onto its own routes. Compression on the root router would put a
//! "did the client ask?" check on all forty-five endpoints and contaminate the rows the
//! compressed family is measured against.

use rb_domain as d;
use salvo::compression::{Compression, CompressionLevel};
use salvo::catcher::Catcher;
use salvo::http::{header, StatusCode};
use salvo::prelude::*;
use serde::Serialize;
use serde_json::Value;

/// Writes the domain's failures onto the response. Handlers call this and never build a
/// 404 or a 422 themselves.
fn fail(res: &mut Response, e: d::Fail) {
    match e {
        d::Fail::NotFound => {
            res.status_code(StatusCode::NOT_FOUND);
            res.render(Json(d::not_found_body()));
        }
        d::Fail::Invalid(errs) => {
            res.status_code(StatusCode::UNPROCESSABLE_ENTITY);
            res.render(Json(d::invalid_body(&errs)));
        }
    }
}

fn ok<T: Serialize + Send>(res: &mut Response, v: Result<T, d::Fail>) {
    match v {
        Ok(v) => res.render(Json(v)),
        Err(e) => fail(res, e),
    }
}

async fn parse(req: &mut Request) -> Result<Value, d::Fail> {
    let raw = req.payload().await.map_err(|_| d::malformed_body())?;
    serde_json::from_slice(raw).map_err(|_| d::malformed_body())
}

fn query(req: &Request) -> d::Query {
    d::parse_query(req.uri().query().unwrap_or(""))
}

fn param(req: &mut Request, name: &str) -> String {
    req.param::<String>(name).unwrap_or_default()
}

// ---- handlers -----------------------------------------------------------------

#[handler]
async fn plaintext(res: &mut Response) {
    res.render(Text::Plain("Hello, World!"));
}

#[handler]
async fn health(res: &mut Response) {
    res.render(Text::Plain("ok"));
}

#[handler]
async fn meta(res: &mut Response) {
    res.render(Json(rb_host::meta("salvo")));
}

#[handler]
async fn small(res: &mut Response) {
    res.render(Json(d::payload("small")));
}

/// Every route salvo does not match. Registered as the catcher so the body is the same
/// JSON every other target answers rather than salvo's own page.
#[handler]
async fn not_found(res: &mut Response, ctrl: &mut FlowCtrl) {
    if res.status_code.is_none_or(|c| c == StatusCode::NOT_FOUND) {
        res.status_code(StatusCode::NOT_FOUND);
        res.render(Json(d::not_found_body()));
        ctrl.skip_rest();
    }
}

/// salvo middleware, not a check inside the handler. An `if` in the handler would measure
/// the language; the point of the authorized family is the framework's own plumbing.
#[handler]
async fn require_token(req: &mut Request, res: &mut Response, ctrl: &mut FlowCtrl) {
    let header = req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
    if !d::token_ok(header) {
        res.status_code(StatusCode::FORBIDDEN);
        res.render(Json(d::forbidden_body()));
        ctrl.skip_rest();
    }
}

/// One middleware layer: it lets the chain continue and does nothing else.
#[handler]
async fn noop() {}

#[handler]
async fn query_one(req: &mut Request, res: &mut Response) {
    res.render(Json(d::coerce_one(&query(req))));
}

#[handler]
async fn query_many(req: &mut Request, res: &mut Response) {
    res.render(Json(d::coerce_many(&query(req))));
}

#[handler]
async fn bind(req: &mut Request, res: &mut Response) {
    match parse(req).await {
        Ok(v) => res.render(Json(d::bind_echo(v))),
        Err(e) => fail(res, e),
    }
}

#[handler]
async fn validate_all(req: &mut Request, res: &mut Response) {
    let v = match parse(req).await {
        Ok(v) => v,
        Err(e) => return fail(res, e),
    };
    ok(res, d::validate_order(&v, false));
}

#[handler]
async fn validate_first(req: &mut Request, res: &mut Response) {
    let v = match parse(req).await {
        Ok(v) => v,
        Err(e) => return fail(res, e),
    };
    ok(res, d::validate_order(&v, true));
}

#[handler]
async fn filter(req: &mut Request, res: &mut Response) {
    res.render(Json(d::domain_filter(&query(req))));
}

#[handler]
async fn lookup(req: &mut Request, res: &mut Response) {
    ok(res, d::get_order(&param(req, "oid")));
}

#[handler]
async fn join(req: &mut Request, res: &mut Response) {
    ok(res, d::domain_join(&param(req, "cid")));
}

#[handler]
async fn aggregate(req: &mut Request, res: &mut Response) {
    ok(res, d::domain_aggregate(&param(req, "region")));
}

#[handler]
async fn create(req: &mut Request, res: &mut Response) {
    let v = match parse(req).await {
        Ok(v) => v,
        Err(e) => return fail(res, e),
    };
    match d::validate_order(&v, false) {
        Ok(v) => {
            res.status_code(StatusCode::CREATED);
            res.add_header(header::LOCATION, d::created_location(), true)
                .ok();
            res.render(Json(v));
        }
        Err(e) => fail(res, e),
    }
}

#[handler]
async fn replace(req: &mut Request, res: &mut Response) {
    let id = match d::get_order(&param(req, "oid")) {
        Ok(o) => o.id,
        Err(e) => return fail(res, e),
    };
    let body = match parse(req).await {
        Ok(v) => v,
        Err(e) => return fail(res, e),
    };
    match d::validate_order(&body, false) {
        Ok(mut v) => {
            v.id = Some(id);
            res.render(Json(v));
        }
        Err(e) => fail(res, e),
    }
}

#[handler]
async fn patch_customer(req: &mut Request, res: &mut Response) {
    let cid = param(req, "cid");
    let body = match parse(req).await {
        Ok(v) => v,
        Err(e) => return fail(res, e),
    };
    ok(res, d::patch_customer(&cid, &body));
}

#[handler]
async fn delete_line(req: &mut Request, res: &mut Response) {
    match d::get_order_line(&param(req, "oid"), &param(req, "lid")) {
        Ok(_) => {
            res.status_code(StatusCode::NO_CONTENT);
        }
        Err(e) => fail(res, e),
    }
}

// ---- routes -------------------------------------------------------------------

macro_rules! payload_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.render(Json(d::payload($size)));
        }
    };
}
payload_handler!(json_small, "small");
payload_handler!(json_medium, "medium");
payload_handler!(json_large, "large");

macro_rules! compressed_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.add_header("x-rb-serial", d::next_serial(), true).ok();
            res.render(Json(d::payload($size)));
        }
    };
}
compressed_handler!(comp_small, "small");
compressed_handler!(comp_medium, "medium");
compressed_handler!(comp_large, "large");

/// Sets the validators and answers the conditional. The comparison requires a non-empty
/// header: matching a missing `if-none-match` against an empty ETag answers 304 to a
/// client that never asked a conditional question.
macro_rules! cached_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(req: &mut Request, res: &mut Response) {
            let etag = d::etag_of($size);
            res.add_header(header::ETAG, etag, true).ok();
            res.add_header(header::CACHE_CONTROL, d::CACHEABLE, true).ok();
            res.add_header("x-rb-serial", d::next_serial(), true).ok();
            let inm =
                req.headers().get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()).unwrap_or("");
            if !inm.is_empty() && inm == etag {
                res.status_code(StatusCode::NOT_MODIFIED);
                return;
            }
            res.render(Json(d::payload($size)));
        }
    };
}
cached_handler!(cached_small, "small");
cached_handler!(cached_medium, "medium");
cached_handler!(cached_large, "large");

macro_rules! template_handler {
    ($name:ident, $size:literal) => {
        #[handler]
        async fn $name(res: &mut Response) {
            res.render(Text::Html(rb_host::render_items(d::payload($size))));
        }
    };
}
template_handler!(tpl_small, "small");
template_handler!(tpl_medium, "medium");

#[tokio::main]
async fn main() {
    let port = rb_host::boot("salvo");

    // Level pinned across every language; the default size threshold is left alone,
    // because whether a framework bothers to compress a body too small to benefit is what
    // compressed.gzip_small is in the set to show.
    let compression = Compression::new().enable_gzip(CompressionLevel::Precise(d::GZIP_LEVEL as u32));

    let mut four = Router::with_path("/middleware/four");
    for _ in 0..4 {
        four = four.hoop(noop);
    }
    let mut sixteen = Router::with_path("/middleware/sixteen");
    for _ in 0..16 {
        sixteen = sixteen.hoop(noop);
    }

    let router = Router::new()
        .push(Router::with_path("/plaintext").get(plaintext))
        .push(Router::with_path("/health").get(health))
        .push(Router::with_path("/__meta").get(meta))
        .push(Router::with_path("/json/small").get(json_small))
        .push(Router::with_path("/json/medium").get(json_medium))
        .push(Router::with_path("/json/large").get(json_large))
        .push(Router::with_path("/parameters/static/segment/literal").get(small))
        .push(Router::with_path("/parameters/{one}/with-second/{two}").get(small))
        .push(Router::with_path("/parameters/{one}").get(small))
        .push(Router::with_path("/query/one").get(query_one))
        .push(Router::with_path("/query/many").get(query_many))
        // The handler reads no header at all, so headers.many minus headers.few is the
        // cost of materialising 27 nobody asked for.
        .push(Router::with_path("/headers").get(small))
        .push(Router::with_path("/middleware/none").get(small))
        .push(four.get(small))
        .push(sixteen.get(small))
        .push(Router::with_path("/authorized/small").hoop(require_token).get(small))
        // rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
        // rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
        .push(
            Router::with_path("/compressed")
                .hoop(compression)
                .push(Router::with_path("/small").get(comp_small))
                .push(Router::with_path("/medium").get(comp_medium))
                .push(Router::with_path("/large").get(comp_large)),
        )
        .push(Router::with_path("/cached/small").get(cached_small))
        .push(Router::with_path("/cached/medium").get(cached_medium))
        .push(Router::with_path("/cached/large").get(cached_large))
        .push(Router::with_path("/template/small").get(tpl_small))
        .push(Router::with_path("/template/medium").get(tpl_medium))
        // bind parses and binds without validating, so validate minus bind is the
        // validator alone rather than the validator plus the parse.
        .push(Router::with_path("/body/bind/small").post(bind))
        .push(Router::with_path("/body/bind/medium").post(bind))
        .push(Router::with_path("/body/validate/first-error").post(validate_first))
        .push(Router::with_path("/body/validate/small").post(validate_all))
        .push(Router::with_path("/body/validate/medium").post(validate_all))
        .push(Router::with_path("/domain/orders").get(filter).post(create))
        .push(Router::with_path("/domain/orders/{oid}").get(lookup).put(replace))
        .push(Router::with_path("/domain/orders/{oid}/lines/{lid}").delete(delete_line))
        .push(Router::with_path("/domain/customers/{cid}/summary").get(join))
        .push(Router::with_path("/domain/customers/{cid}").patch(patch_customer))
        .push(Router::with_path("/domain/regions/{region}/report").get(aggregate));

    // rb:snippet errors.unmatched
    let service = Service::new(router).catcher(Catcher::default().hoop(not_found));
    let acceptor = TcpListener::new(("0.0.0.0", port)).bind().await;
    Server::new(acceptor).serve(service).await;
}
