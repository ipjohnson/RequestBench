use std::time::Duration;

use axum::body::Body;
use axum::extract::Path;
use axum::http::HeaderMap;
use axum::http::header::{CONTENT_TYPE, VARY};
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::payloads::Payload;
use crate::serial::{self, SERIAL};

// rb:wiring cache.*
/// An answer as Loco's cache keeps it: the serial the handler wrote and the JSON it answered. The
/// cache holds each value as JSON text, so a replay reads the answer back out of that.
#[derive(Deserialize, Serialize)]
struct Stored {
    serial: String,
    body: String,
}

/// The answer Loco's cache holds under this key, or else the handler's, which the cache then holds
/// for 30 seconds. Loco ships no response cache, so the handlers keep their
/// answers in its cache themselves.
async fn replay(ctx: &AppContext, key: &str, vary: Option<&str>, payload: &Payload) -> Result<Response> {
    let stored = match ctx.cache.get::<Stored>(key).await? {
        Some(stored) => stored,
        None => {
            let stored = Stored { serial: serial::next(), body: serde_json::to_string(payload)? };
            ctx.cache.insert_with_expiry(key, &stored, Duration::from_secs(30)).await?;
            stored
        }
    };
    let mut answer = format::render().header(SERIAL, &stored.serial);
    // The Vary header tells a cache in front of the framework what the answer depends on. The
    // store keys on the route's own list.
    if let Some(vary) = vary {
        answer = answer.header(VARY, vary);
    }
    Ok(answer.response().header(CONTENT_TYPE, "application/json").body(Body::from(stored.body))?)
}

/// The path and the values of the headers a vary route is keyed on, in the route's order.
fn keyed_on(path: &str, names: &[&str], headers: &HeaderMap) -> String {
    names.iter().fold(path.to_owned(), |key, name| {
        let value = headers.get(*name).and_then(|value| value.to_str().ok()).unwrap_or_default();
        format!("{key}|{value}")
    })
}
// rb:end

/// The headers cache.vary_one is keyed on.
const ONE: [&str; 1] = ["x-rb-tenant"];

/// The headers cache.vary_many is keyed on.
const MANY: [&str; 3] = ["x-rb-channel", "x-rb-region", "x-rb-tenant"];

// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so a
// replayed answer repeats the serial it was stored with. A vary route's key adds its headers.

// rb:handler cache.small
async fn small(State(ctx): State<AppContext>, SharedStore(p): SharedStore<&'static Payloads>, Path(key): Path<String>) -> Result<Response> {
    replay(&ctx, &format!("/cache/small/{key}"), None, &p.small).await
}

// rb:handler cache.medium
async fn medium(State(ctx): State<AppContext>, SharedStore(p): SharedStore<&'static Payloads>, Path(key): Path<String>) -> Result<Response> {
    replay(&ctx, &format!("/cache/medium/{key}"), None, &p.medium).await
}

// rb:handler cache.large
async fn large(State(ctx): State<AppContext>, SharedStore(p): SharedStore<&'static Payloads>, Path(key): Path<String>) -> Result<Response> {
    replay(&ctx, &format!("/cache/large/{key}"), None, &p.large).await
}

// rb:handler cache.vary_one
async fn vary_one(State(ctx): State<AppContext>, SharedStore(p): SharedStore<&'static Payloads>, Path(key): Path<String>, headers: HeaderMap) -> Result<Response> {
    replay(&ctx, &keyed_on(&format!("/cache/vary/one/{key}"), &ONE, &headers), Some(&ONE.join(", ")), &p.small).await
}

// rb:handler cache.vary_many
async fn vary_many(State(ctx): State<AppContext>, SharedStore(p): SharedStore<&'static Payloads>, Path(key): Path<String>, headers: HeaderMap) -> Result<Response> {
    replay(&ctx, &keyed_on(&format!("/cache/vary/many/{key}"), &MANY, &headers), Some(&MANY.join(", ")), &p.small).await
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("cache")
        .add("/small/{key}", get(small))
        .add("/medium/{key}", get(medium))
        .add("/large/{key}", get(large))
        .add("/vary/one/{key}", get(vary_one))
        .add("/vary/many/{key}", get(vary_many))
}
