use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;
use crate::payloads::Payload;

#[derive(Serialize)]
struct One {
    one: i64,
}

#[derive(Serialize)]
struct Two {
    one: i64,
    two: i64,
}

#[derive(Serialize)]
struct Three {
    one: i64,
    two: i64,
    three: i64,
}

/// parameters: path segments, each bound as an integer by Rocket's FromParam before the handler
/// runs. Rocket ranks a route of static segments above one with a capture, so the static route
/// answers its own path. The three captures match the paths of the one and two capture routes too,
/// and Rocket refuses two routes of the same rank that match one path, so that route is ranked
/// below them.
#[get("/parameters/static/segment/literal")]
fn fixed(p: &State<Payloads>) -> Json<&Payload> {
    Json(&p.small)
}

#[get("/parameters/<one>/segment/literal")]
fn one(one: i64, p: &State<Payloads>) -> Json<Echoed<'_, One>> {
    Json(Echoed::new(&p.small, One { one }))
}

#[get("/parameters/<one>/with-second/<two>")]
fn two(one: i64, two: i64, p: &State<Payloads>) -> Json<Echoed<'_, Two>> {
    Json(Echoed::new(&p.small, Two { one, two }))
}

#[get("/parameters/<one>/<two>/<three>", rank = 1)]
fn three(one: i64, two: i64, three: i64, p: &State<Payloads>) -> Json<Echoed<'_, Three>> {
    Json(Echoed::new(&p.small, Three { one, two, three }))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![fixed, one, two, three])
}
