use std::fmt::Write;

use axum::body::{Body, to_bytes};
use axum::extract::Request;
use axum::http::header::{CONTENT_LENGTH, CONTENT_TYPE, ETAG, IF_NONE_MATCH};
use axum::http::{HeaderValue, StatusCode};
use axum::middleware::{Next, from_fn};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use sha1::{Digest, Sha1};

use crate::Payloads;
use crate::serial;

/// etag: axum and tower-http compute no validator for an answer a handler builds, so this family
/// is wired by hand, as a layer on its router. The layer hashes what the handler answered and
/// answers 304 when If-None-Match already names the hash. The body is built and hashed before
/// anything is compared, so a 304 saves the write and nothing else.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/etag/small", get(move || async move { (serial::fresh(), Json(&p.small)) }))
        .route("/etag/large", get(move || async move { (serial::fresh(), Json(&p.large)) }))
        // rb:wiring etag.*
        .layer(from_fn(revalidate))
}

// rb:wiring etag.*
async fn revalidate(request: Request, next: Next) -> Response {
    let asked = request.headers().get(IF_NONE_MATCH).cloned();
    let (mut parts, body) = next.run(request).await.into_parts();
    let Ok(bytes) = to_bytes(body, usize::MAX).await else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let tag = quoted_hex(&Sha1::digest(&bytes));
    let known = asked.as_ref().is_some_and(|asked| names(asked, &tag));
    parts.headers.insert(ETAG, HeaderValue::from_str(&tag).expect("a quoted hex digest is a header value"));
    if known {
        parts.status = StatusCode::NOT_MODIFIED;
        parts.headers.remove(CONTENT_TYPE);
        parts.headers.remove(CONTENT_LENGTH);
        return Response::from_parts(parts, Body::empty());
    }
    Response::from_parts(parts, Body::from(bytes))
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
