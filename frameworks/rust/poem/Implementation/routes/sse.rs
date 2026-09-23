use futures_util::stream::{self, StreamExt};
use poem::endpoint::make_sync;
use poem::web::sse::{Event, SSE};
use poem::{IntoResponse, Route, get};

use crate::Payloads;

/// sse: items.medium's rows as server-sent events, through poem's own response for them. poem's
/// events carry text, so each row is serialised with serde_json as the data of one event.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route.at("/sse/medium", get(make_sync(move |_| {
        let events = stream::iter(&p.medium.items).map(|row| Event::message(serde_json::to_string(row).expect("a row is JSON")));
        // A Response, because make_sync asks for a Sync answer and SSE holds a stream that is not.
        SSE::new(events).into_response()
    })))
}
