use futures_util::stream::{self, StreamExt};
use salvo::http::HeaderValue;
use salvo::http::header::CONTENT_TYPE;
use salvo::prelude::*;

use crate::Payloads;
use crate::payloads::Payload;

// rb:handler stream.ndjson
/// items.medium's rows written one per line, each line a chunk of its own. The body is a stream,
/// so its length is never known and the answer goes out chunked.
#[derive(Clone, Copy)]
struct Lines(&'static Payload);

#[handler]
impl Lines {
    async fn handle(&self, res: &mut Response) {
        res.headers_mut().insert(CONTENT_TYPE, HeaderValue::from_static("application/x-ndjson"));
        res.stream(stream::iter(&self.0.items).map(|row| {
            serde_json::to_vec(row).map(|mut line| {
                line.push(b'\n');
                line
            })
        }));
    }
}
// rb:end

/// stream: items.medium's rows as newline-delimited JSON.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/stream/items").get(Lines(&p.medium))
}
