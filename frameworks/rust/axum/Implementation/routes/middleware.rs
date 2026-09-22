use axum::extract::Request;
use axum::middleware::{Next, from_fn};
use axum::response::Response;
use axum::routing::{MethodRouter, get};
use axum::{Json, Router};

use crate::Payloads;

/// middleware: no-op layers in front of the handler. axum's own middleware is a tower layer, and
/// from_fn makes one of an async function. Layered on the route, it runs on that route alone.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/middleware/none", get(move || async move { Json(&p.small) }))
        .route("/middleware/four", layers(get(move || async move { Json(&p.small) }), 4))
        .route("/middleware/sixteen", layers(get(move || async move { Json(&p.small) }), 16))
}

// rb:wiring middleware.*
async fn noop(request: Request, next: Next) -> Response {
    next.run(request).await
}

fn layers(route: MethodRouter, count: usize) -> MethodRouter {
    (0..count).fold(route, |route, _| route.layer(from_fn(noop)))
}
// rb:end
