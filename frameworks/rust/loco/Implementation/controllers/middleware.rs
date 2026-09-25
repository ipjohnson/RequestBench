use axum::extract::Request;
use axum::middleware::{Next, from_fn};
use loco_rs::prelude::*;

use crate::Payloads;

// rb:wiring middleware.*
/// One layer: axum's from_fn middleware, which calls the next and does nothing else.
async fn layer(request: Request, next: Next) -> Response {
    next.run(request).await
}

/// The routes with this many layers, each added with Loco's Routes::layer, which adds a layer to
/// the routes of one Routes alone.
fn layered(routes: Routes, count: usize) -> Routes {
    (0..count).fold(routes, |routes, _| routes.layer(from_fn(layer)))
}
// rb:end

// rb:handler middleware.none
async fn none(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

// rb:handler middleware.four
async fn four(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

// rb:handler middleware.sixteen
async fn sixteen(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

/// middleware: no-op layers in front of the handler, four or sixteen, on its route alone. Each
/// route is a Routes of its own, because Routes::layer adds a layer to every route it holds.
pub fn routes() -> Vec<Routes> {
    vec![
        Routes::new().prefix("middleware").add("/none", get(none)),
        layered(Routes::new().prefix("middleware").add("/four", get(four)), 4),
        layered(Routes::new().prefix("middleware").add("/sixteen", get(sixteen)), 16),
    ]
}
