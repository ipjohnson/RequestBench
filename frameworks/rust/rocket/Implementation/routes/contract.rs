use rocket::serde::json::Json;
use rocket::{Build, Rocket, get, routes};
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
    framework: "Rocket",
    version: env!("RB_ROCKET_VERSION"),
    runtime: env!("RB_RUSTC_VERSION"),
    serializer: concat!("serde_json ", env!("RB_SERDE_JSON_VERSION")),
};

// The payloads are loaded before Rocket ignites, so a server that answers has them.
#[get("/health")]
fn health() -> &'static str {
    "ok"
}

#[get("/__meta")]
fn meta() -> Json<Meta> {
    Json(META)
}

/// /health and /__meta, which the contract asks of every framework outside the corpus.
pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![health, meta])
}
