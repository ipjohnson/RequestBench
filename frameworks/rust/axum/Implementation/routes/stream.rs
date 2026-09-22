use axum::body::{Body, Bytes};
use axum::http::header::CONTENT_TYPE;
use axum::routing::get;
use axum::Router;
use futures_util::stream::{self, StreamExt};

use crate::Payloads;

/// stream: items.medium's rows written one per line, each line a chunk of its own. The body is a
/// stream, so its length is never known and the answer goes out chunked.
pub fn router(p: &'static Payloads) -> Router {
    Router::new().route("/stream/items", get(move || async move {
        let lines = stream::iter(&p.medium.items).map(|row| {
            serde_json::to_vec(row).map(|mut line| {
                line.push(b'\n');
                Bytes::from(line)
            })
        });
        ([(CONTENT_TYPE, "application/x-ndjson")], Body::from_stream(lines))
    }))
}
