use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};
use rocket_async_compression::Compress;

use crate::Payloads;
use crate::payloads::Payload;
use crate::serial::Fresh;

/// compressed: these routes answer like any other, and each wraps its answer in the responder
/// below, which gzips it when the request asks for it.
#[get("/compressed/small")]
fn small(p: &State<Payloads>) -> Compress<Fresh<Json<&Payload>>> {
    gzipped(&p.small)
}

#[get("/compressed/large")]
fn large(p: &State<Payloads>) -> Compress<Fresh<Json<&Payload>>> {
    gzipped(&p.large)
}

// rb:wiring compressed.*
/// rocket_async_compression's Compress responder, the per-route form of the crate's fairing,
/// because Rocket 0.5 ships no compression. gzip at the fastest level every framework here
/// compresses at. It compresses whatever the size.
fn gzipped(payload: &Payload) -> Compress<Fresh<Json<&Payload>>> {
    Compress::fastest(Fresh::new(Json(payload)))
}
// rb:end

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![small, large])
}
