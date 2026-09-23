use actix_web::web::{self, ServiceConfig};
use actix_web_lab::sse::{Data, Event, Sse};
use futures_util::stream::{self, StreamExt};

use crate::Payloads;

/// sse: items.medium's rows as server-sent events. actix-web has no response for them, and
/// actix-web-lab, where the actix project tries out what may join it, has one, which writes each
/// row serde_json serialises as the data of one event.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    // rb:wiring sse.*
    cfg.route("/sse/medium", web::get().to(move || async move { Sse::from_stream(stream::iter(&p.medium.items).map(|row| Data::new_json(row).map(Event::Data))) }));
}
