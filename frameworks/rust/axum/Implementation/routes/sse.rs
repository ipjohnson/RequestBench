use axum::response::sse::{Event, Sse};
use axum::routing::get;
use axum::Router;
use futures_util::stream::{self, StreamExt};

use crate::Payloads;

/// sse: items.medium's rows as server-sent events, through axum's own response for them, which
/// writes each row serde_json serialises as the data of one event.
pub fn router(p: &'static Payloads) -> Router {
    Router::new().route("/sse/medium", get(move || async move { Sse::new(stream::iter(&p.medium.items).map(|row| Event::default().json_data(row))) }))
}
