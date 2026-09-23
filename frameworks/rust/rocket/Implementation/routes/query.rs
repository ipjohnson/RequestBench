use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};
use serde::Serialize;

use crate::Payloads;
use crate::answers::{Echoed, Search};

#[derive(Serialize)]
struct Page {
    page: i64,
}

/// query: the query string bound by the route attribute. `?<page>` binds one value as an integer,
/// and `?<search..>` binds every value into a struct through Rocket's FromForm.
#[get("/query/one?<page>")]
fn one(page: i64, p: &State<Payloads>) -> Json<Echoed<'_, Page>> {
    Json(Echoed::new(&p.small, Page { page }))
}

#[get("/query/many?<search..>")]
fn many<'r>(search: Search<'r>, p: &'r State<Payloads>) -> Json<Echoed<'r, Search<'r>>> {
    Json(Echoed::new(&p.small, search))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![one, many])
}
