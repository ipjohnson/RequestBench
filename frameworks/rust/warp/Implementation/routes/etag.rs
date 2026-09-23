use std::fmt::Write;

use bytes::Bytes;
use http_body_util::BodyExt;
use sha1::{Digest, Sha1};
use warp::http::header::{CONTENT_LENGTH, CONTENT_TYPE, ETAG};
use warp::http::{HeaderValue, StatusCode};
use warp::reply::Response;
use warp::{Filter, Rejection, Reply};

use crate::{Payloads, Routes, serial};

/// etag: warp computes no validator for an answer a handler builds, so this family is wired by
/// hand, as a filter after each route's handler. It hashes what the handler answered and answers
/// 304 when If-None-Match already names the hash. The body is built and hashed before anything is
/// compared, so a 304 saves the write and nothing else.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler etag.small
    let small = revalidated(warp::path!("etag" / "small").and(warp::get()).map(move || serial::fresh(warp::reply::json(&p.small))));
    // rb:handler etag.large,etag.match_large,etag.stale_large
    let large = revalidated(warp::path!("etag" / "large").and(warp::get()).map(move || serial::fresh(warp::reply::json(&p.large))));
    small.or(large).unify().boxed()
}

// rb:wiring etag.*
fn revalidated<F, R>(route: F) -> impl Filter<Extract = (Response,), Error = Rejection> + Clone
where
    F: Filter<Extract = (R,), Error = Rejection> + Clone + Send + Sync + 'static,
    R: Reply + 'static,
{
    route.and(warp::header::optional::<String>("if-none-match")).and_then(revalidate)
}

async fn revalidate<R: Reply>(reply: R, asked: Option<String>) -> Result<Response, Rejection> {
    let (mut parts, body) = reply.into_response().into_parts();
    let Ok(collected) = body.collect().await else {
        return Ok(StatusCode::INTERNAL_SERVER_ERROR.into_response());
    };
    let bytes = collected.to_bytes();
    let tag = quoted_hex(&Sha1::digest(&bytes));
    let known = asked.as_deref().is_some_and(|asked| names(asked, &tag));
    parts.headers.insert(ETAG, HeaderValue::from_str(&tag).expect("a quoted hex digest is a header value"));
    if known {
        parts.status = StatusCode::NOT_MODIFIED;
        parts.headers.remove(CONTENT_TYPE);
        parts.headers.remove(CONTENT_LENGTH);
        return Ok(Response::from_parts(parts, Bytes::new().into()));
    }
    Ok(Response::from_parts(parts, bytes.into()))
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
fn names(asked: &str, tag: &str) -> bool {
    asked.split(',').map(str::trim).any(|t| t == "*" || t.trim_start_matches("W/") == tag)
}
// rb:end
