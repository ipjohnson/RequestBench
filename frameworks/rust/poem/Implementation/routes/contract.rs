use poem::endpoint::make_sync;
use poem::web::Json;
use poem::{Route, get};
use serde::Serialize;

use crate::Payloads;

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
    framework: "poem",
    version: env!("RB_POEM_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

/// /health and /__meta, which the contract asks of every framework outside the corpus.
pub fn add(route: Route, _: &'static Payloads) -> Route {
    route
        // The payloads are loaded before the server starts, so a server that answers has them.
        .at("/health", get(make_sync(|_| "ok")))
        .at("/__meta", get(make_sync(|_| Json(META))))
}
