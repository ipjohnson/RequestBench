use futures_util::stream::{self, StreamExt};
use warp::Filter;
use warp::sse::Event;

use crate::{Payloads, Routes, answer};

/// sse: items.medium's rows as server-sent events, through warp's own reply for them, which writes
/// each row serde_json serialises as the data of one event.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler sse.medium
    answer(warp::path!("sse" / "medium").and(warp::get()).map(move || warp::sse::reply(stream::iter(&p.medium.items).map(|row| Event::default().json_data(row))))).boxed()
}
