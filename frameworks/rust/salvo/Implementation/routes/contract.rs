use salvo::prelude::*;
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
    framework: "salvo",
    version: env!("RB_SALVO_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

/// The payloads are loaded before the server starts, so a server that answers has them.
#[handler]
async fn health() -> &'static str {
    "ok"
}

#[handler]
async fn meta() -> Json<Meta> {
    Json(META)
}

/// /health and /__meta, which the contract asks of every framework outside the corpus.
pub fn router() -> Router {
    Router::new()
        .push(Router::with_path("/health").get(health))
        .push(Router::with_path("/__meta").get(meta))
}
