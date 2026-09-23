use futures_util::stream::{self, StreamExt};
use poem::endpoint::make_sync;
use poem::{Body, IntoResponse, Route, get};

use crate::Payloads;

/// stream: items.medium's rows written one per line, each line a chunk of its own. The body is a
/// stream, so its length is never known and the answer goes out chunked.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route.at("/stream/items", get(make_sync(move |_| {
        let lines = stream::iter(&p.medium.items).map(|row| {
            serde_json::to_vec(row).map(|mut line| {
                line.push(b'\n');
                line
            })
        });
        Body::from_bytes_stream(lines).with_content_type("application/x-ndjson")
    })))
}
