use axum::response::sse::{Event, Sse};
use futures_util::stream::{self, StreamExt};
use loco_rs::prelude::*;

use crate::Payloads;

// rb:handler sse.medium
/// sse: items.medium's rows as server-sent events, through axum's own response for them, which
/// writes each row serde_json serialises as the data of one event. Loco has none of its own.
async fn medium(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    Ok(Sse::new(stream::iter(&p.medium.items).map(|row| Event::default().json_data(row))).into_response())
}

pub fn routes() -> Routes {
    Routes::new().prefix("sse").add("/medium", get(medium))
}
