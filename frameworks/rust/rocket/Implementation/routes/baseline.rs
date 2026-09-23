use rocket::{Build, Rocket, get, routes};

use crate::Payloads;

/// baseline: the dispatch floor, with nothing serialised. Rocket sends a &str as text/plain.
#[get("/plaintext")]
fn plaintext() -> &'static str {
    "Hello, World!"
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![plaintext])
}
