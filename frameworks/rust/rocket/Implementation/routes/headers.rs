use rocket::http::Status;
use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;
use crate::payloads::Payload;

// rb:wiring headers.*
/// The three headers /headers/bind echoes. Rocket has no header binder, and a request guard is
/// how a route takes anything from the request beyond its path, query and body. A header that is
/// missing or that does not convert fails the guard with 400, as the guard in Rocket's guide does.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound<'r> {
    tenant: &'r str,
    request_id: &'r str,
    account: i64,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Bound<'r> {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> request::Outcome<Self, ()> {
        let text = |name| request.headers().get_one(name);
        match (text("x-rb-tenant"), text("x-rb-request-id"), text("x-rb-account").and_then(|v| v.parse().ok())) {
            (Some(tenant), Some(request_id), Some(account)) => Outcome::Success(Bound { tenant, request_id, account }),
            _ => Outcome::Error((Status::BadRequest, ())),
        }
    }
}
// rb:end

/// headers: /headers reads no header, and /headers/bind takes three through the guard, the
/// account as an integer.
#[get("/headers")]
fn few(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

#[get("/headers/bind")]
fn bind<'r>(bound: Bound<'r>, p: &'r State<Payloads>) -> Json<Echoed<'r, Bound<'r>>> {
    Json(Echoed::new(&p.small, bound))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![few, bind])
}
