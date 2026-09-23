use std::fmt::Write;

use poem::endpoint::make_sync;
use poem::http::header::{CONTENT_LENGTH, CONTENT_TYPE, ETAG, IF_NONE_MATCH};
use poem::http::{HeaderValue, StatusCode};
use poem::web::Json;
use poem::{Body, Endpoint, EndpointExt, IntoResponse, Request, Response, Result, Route, get};
use sha1::{Digest, Sha1};

use crate::{Payloads, serial};

/// etag: poem computes a validator for a static file and for nothing a handler builds, so this
/// family is wired by hand, as a function middleware around each route. It hashes what the handler
/// answered and answers 304 when If-None-Match already names the hash. The body is built and hashed
/// before anything is compared, so a 304 saves the write and nothing else.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/etag/small", get(make_sync(move |_| serial::fresh(Json(&p.small)))).around(revalidate))
        .at("/etag/large", get(make_sync(move |_| serial::fresh(Json(&p.large)))).around(revalidate))
}

// rb:wiring etag.*
async fn revalidate<E: Endpoint>(next: E, req: Request) -> Result<Response> {
    let asked = req.headers().get(IF_NONE_MATCH).cloned();
    let (mut parts, body) = next.call(req).await?.into_response().into_parts();
    let bytes = body.into_bytes().await?;
    let tag = quoted_hex(&Sha1::digest(&bytes));
    let known = asked.as_ref().is_some_and(|asked| names(asked, &tag));
    parts.headers.insert(ETAG, HeaderValue::from_str(&tag).expect("a quoted hex digest is a header value"));
    if known {
        parts.status = StatusCode::NOT_MODIFIED;
        parts.headers.remove(CONTENT_TYPE);
        parts.headers.remove(CONTENT_LENGTH);
        return Ok(Response::from_parts(parts, Body::empty()));
    }
    Ok(Response::from_parts(parts, Body::from(bytes)))
}

fn quoted_hex(digest: &[u8]) -> String {
    let mut tag = String::with_capacity(2 + 2 * digest.len());
    tag.push('"');
    for byte in digest {
        let _ = write!(tag, "{byte:02x}");
    }
    tag.push('"');
    tag
}

/// Whether an If-None-Match list names this tag, compared weakly, as RFC 9110 has a server compare
/// it.
fn names(asked: &HeaderValue, tag: &str) -> bool {
    asked.to_str().is_ok_and(|list| list.split(',').map(str::trim).any(|t| t == "*" || t.trim_start_matches("W/") == tag))
}
// rb:end
