use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

/// /__meta: what ran, recorded on the result row and never checked. build.rs reads the versions
/// from Cargo.lock and rustc when the binary is built.
#[derive(Serialize)]
struct Meta {
    framework: &'static str,
    version: &'static str,
    runtime: &'static str,
    serializer: &'static str,
}

const META: Meta = Meta {
    framework: "axum",
    version: env!("RB_AXUM_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

/// /health and /__meta, which the contract asks of every framework outside the corpus.
pub fn router() -> Router {
    Router::new()
        // The payloads are loaded before the server starts, so a server that answers has them.
        .route("/health", get(|| async { "ok" }))
        .route("/__meta", get(|| async { Json(META) }))
}
