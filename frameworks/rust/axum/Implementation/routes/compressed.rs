use axum::routing::get;
use axum::{Json, Router};
use tower_http::CompressionLevel;
use tower_http::compression::CompressionLayer;

use crate::Payloads;
use crate::serial;

/// compressed: these routes answer like any other. tower-http's compression layer, on this
/// family's routes alone, gzips the answer when the request asks for it.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/compressed/small", get(move || async move { (serial::fresh(), Json(&p.small)) }))
        .route("/compressed/large", get(move || async move { (serial::fresh(), Json(&p.large)) }))
        // rb:wiring compressed.*
        // gzip at the fastest level every framework here compresses at, and the default
        // predicate, which leaves a body under 32 bytes alone.
        .layer(CompressionLayer::new().quality(CompressionLevel::Fastest))
}
