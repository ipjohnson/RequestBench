use axum::body::{Body, Bytes};
use axum::http::header::CONTENT_TYPE;
use futures_util::stream::{self, StreamExt};
use loco_rs::prelude::*;

use crate::Payloads;

// rb:handler stream.ndjson
/// stream: items.medium's rows written one per line, each line a chunk of its own, as the body of
/// the response Loco's RenderBuilder hands over. Loco has no streaming response of its own. The body
/// is a stream, so its length is never known and the answer goes out chunked.
async fn items(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    let lines = stream::iter(&p.medium.items).map(|row| {
        serde_json::to_vec(row).map(|mut line| {
            line.push(b'\n');
            Bytes::from(line)
        })
    });
    Ok(format::render().response().header(CONTENT_TYPE, "application/x-ndjson").body(Body::from_stream(lines))?)
}

pub fn routes() -> Routes {
    Routes::new().prefix("stream").add("/items", get(items))
}
