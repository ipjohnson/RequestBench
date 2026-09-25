use std::fmt::Write;

use axum::body::Body;
use axum::http::header::CONTENT_TYPE;
use loco_rs::prelude::*;
use sha1::{Digest, Sha1};

use crate::Payloads;
use crate::payloads::Payload;
use crate::serial::{self, SERIAL};

// rb:wiring etag.*
/// The answer with a tag of its bytes, set with Loco's RenderBuilder::etag. Loco's etag middleware,
/// on by default, answers 304 when If-None-Match names the tag a handler set, and computes none of
/// its own. The body is built and hashed before anything is compared, so a 304 saves the write and
/// nothing else.
fn tagged(payload: &Payload) -> Result<Response> {
    let body = serde_json::to_vec(payload)?;
    let tag = quoted_hex(&Sha1::digest(&body));
    let answer = format::render().etag(&tag)?.header(SERIAL, serial::next());
    Ok(answer.response().header(CONTENT_TYPE, "application/json").body(Body::from(body))?)
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
// rb:end

// rb:handler etag.small
async fn small(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    tagged(&p.small)
}

// rb:handler etag.large,etag.match_large,etag.stale_large
async fn large(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    tagged(&p.large)
}

pub fn routes() -> Routes {
    Routes::new().prefix("etag").add("/small", get(small)).add("/large", get(large))
}
