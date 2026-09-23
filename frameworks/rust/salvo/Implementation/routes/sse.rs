use futures_util::stream::{self, StreamExt};
use salvo::prelude::*;
use salvo::sse::{self, SseEvent};

use crate::Payloads;
use crate::payloads::Payload;

// rb:handler sse.medium
/// items.medium's rows through Salvo's own event stream, which writes each row SseEvent::json
/// serialises as the data of one event.
#[derive(Clone, Copy)]
struct Events(&'static Payload);

#[handler]
impl Events {
    async fn handle(&self, res: &mut Response) {
        sse::stream(res, stream::iter(&self.0.items).map(|row| SseEvent::default().json(row)));
    }
}
// rb:end

/// sse: items.medium's rows as server-sent events.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/sse/medium").get(Events(&p.medium))
}
