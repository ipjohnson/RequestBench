use rocket::http::Method;
use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, get, routes};
use rocket_cors::{AllowedHeaders, AllowedOrigins, CorsOptions, Guard, Responder};

use crate::Payloads;
use crate::payloads::Payload;
use crate::serial::Fresh;

/// cors: rocket_cors in its request-guard mode, which puts the policy on the routes that take the
/// guard and on no other. Its catch-all OPTIONS route, mounted under /cors, answers a preflight
/// before any handler of this application runs, so the handler's x-rb-serial is absent from it.
#[get("/cors/small")]
fn small<'r>(cors: Guard<'r>, p: &'r State<Payloads>) -> Responder<Fresh<Json<&'r Payload>>> {
    cors.responder(Fresh::new(Json(&p.small)))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    // rb:wiring cors.*
    let policy = CorsOptions {
        allowed_origins: AllowedOrigins::some_exact(&["https://shop.example.com"]),
        allowed_methods: [Method::Get.into()].into_iter().collect(),
        allowed_headers: AllowedHeaders::some(&["x-rb-tenant"]),
        max_age: Some(600),
        ..Default::default()
    };
    rocket
        .mount("/", routes![small])
        .mount("/cors", rocket_cors::catch_all_options_routes())
        .manage(policy.to_cors().expect("the CORS policy is valid"))
    // rb:end
}
