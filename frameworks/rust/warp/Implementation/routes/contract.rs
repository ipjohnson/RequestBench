use serde::Serialize;
use warp::Filter;

use crate::{Routes, answer};

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
    framework: "warp",
    version: env!("RB_WARP_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

/// /health and /__meta, which the contract asks of every framework outside the corpus. warp tries
/// them last, so no measured route waits on them.
pub fn routes() -> Routes {
    // The payloads are loaded before the server starts, so a server that answers has them.
    let health = warp::path!("health").and(warp::get()).map(|| "ok");
    let meta = warp::path!("__meta").and(warp::get()).map(|| warp::reply::json(&META));
    answer(health).or(answer(meta)).unify().boxed()
}
