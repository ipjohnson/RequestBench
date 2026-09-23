use rocket::http::Status;
use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring authorized.*
/// A request guard, which Rocket's documentation names as the place for authorization. Rocket
/// resolves it before the handler, and a guard that fails with 403 hands the request to the
/// catcher for 403, so the handler never runs.
struct Bearer;

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Bearer {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> request::Outcome<Self, ()> {
        let token = &request.rocket().state::<Payloads>().expect("the payloads are managed").settings.token;
        match request.headers().get_one("authorization").and_then(|v| v.strip_prefix("Bearer ")) {
            Some(given) if given == token => Outcome::Success(Bearer),
            _ => Outcome::Error((Status::Forbidden, ())),
        }
    }
}
// rb:end

/// authorized: the bearer guard on this one route, with settings.json's token.
#[get("/authorized/small")]
fn small(_bearer: Bearer, p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![small])
}
