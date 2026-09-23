use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};

use crate::Payloads;
use crate::payloads::Payload;

/// json: a payload the framework already holds, serialised at three sizes. The payloads are
/// Rocket's managed state, which a handler reaches through the State guard.
#[get("/json/small")]
fn small(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

#[get("/json/medium")]
fn medium(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.medium)
}

#[get("/json/large")]
fn large(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.large)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![small, medium, large])
}
