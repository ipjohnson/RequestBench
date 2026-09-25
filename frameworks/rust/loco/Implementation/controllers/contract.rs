use loco_rs::prelude::*;
use serde::Serialize;

/// /__meta: what ran, recorded on the result row and never checked. build.rs reads the versions
/// from Cargo.lock and rustc when the binary is built.
#[derive(Serialize)]
struct Meta {
    framework: &'static str,
    version: &'static str,
    runtime: &'static str,
    adapter: &'static str,
    serializer: &'static str,
}

const META: Meta = Meta {
    framework: "Loco",
    version: env!("RB_LOCO_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    adapter: concat!("axum ", env!("RB_AXUM_VERSION")),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

// The payloads are loaded before the server starts, so a server that answers has them.
async fn health() -> Result<Response> {
    format::text("ok")
}

async fn meta() -> Result<Response> {
    format::json(&META)
}

/// /health and /__meta, which the contract asks of every framework outside the corpus.
pub fn routes() -> Routes {
    Routes::new().add("/health", get(health)).add("/__meta", get(meta))
}
