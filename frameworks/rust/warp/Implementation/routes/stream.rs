use bytes::Bytes;
use futures_util::stream::{self, StreamExt};
use warp::Filter;
use warp::http::header::CONTENT_TYPE;

use crate::{Payloads, Routes, answer};

/// stream: items.medium's rows written one per line, each line a chunk of its own, by warp's stream
/// reply. The body is a stream, so its length is never known and the answer goes out chunked.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler stream.ndjson
    answer(warp::path!("stream" / "items").and(warp::get()).map(move || {
        let lines = stream::iter(&p.medium.items).map(|row| {
            serde_json::to_vec(row).map(|mut line| {
                line.push(b'\n');
                Bytes::from(line)
            })
        });
        warp::reply::with_header(warp::reply::stream(lines), CONTENT_TYPE, "application/x-ndjson")
    }))
    .boxed()
}
