use std::convert::Infallible;

use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring middleware.*
/// A request guard that lets every request through. Rocket's middleware, its fairings, run on
/// every route, and its documentation points per-route work at request guards, which it resolves
/// one after another before the handler runs.
struct Pass;

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Pass {
    type Error = Infallible;

    async fn from_request(_: &'r Request<'_>) -> request::Outcome<Self, Infallible> {
        Outcome::Success(Pass)
    }
}
// rb:end

/// middleware: no-op request guards in front of the handler, four or sixteen of them.
#[get("/middleware/none")]
fn none(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

#[get("/middleware/four")]
fn four(_a: Pass, _b: Pass, _c: Pass, _d: Pass, p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

#[get("/middleware/sixteen")]
fn sixteen(
    _a: Pass, _b: Pass, _c: Pass, _d: Pass, _e: Pass, _f: Pass, _g: Pass, _h: Pass,
    _i: Pass, _j: Pass, _k: Pass, _l: Pass, _m: Pass, _n: Pass, _o: Pass, _p: Pass,
    p: &State<Payloads>,
) -> Json<&Payload> {
    Json(&p.small)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![none, four, sixteen])
}
