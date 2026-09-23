use actix_web::HttpResponse;
use actix_web::web::{self, Bytes, ServiceConfig};
use futures_util::stream::{self, StreamExt};

use crate::Payloads;

/// stream: items.medium's rows written one per line, each line a chunk of its own. The body is a
/// stream, so its length is never known and the answer goes out chunked.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/stream/items", web::get().to(move || async move {
        let lines = stream::iter(&p.medium.items).map(|row| {
            serde_json::to_vec(row).map(|mut line| {
                line.push(b'\n');
                Bytes::from(line)
            })
        });
        HttpResponse::Ok().content_type("application/x-ndjson").streaming(lines)
    }));
}
