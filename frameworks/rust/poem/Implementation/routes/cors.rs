use poem::endpoint::make_sync;
use poem::middleware::Cors;
use poem::web::Json;
use poem::{EndpointExt, Route, get};

use crate::payloads::CorsSettings;
use crate::{Payloads, serial};

/// cors: poem's CORS middleware on this family's route and nowhere else. It wraps the route's
/// method router, so it sees the preflight and answers it before any handler runs, and the
/// handler's x-rb-serial is absent from the answer.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route.at("/cors/small", get(make_sync(move |_| serial::fresh(Json(&p.small)))).with(policy(&p.settings.cors)))
}

// rb:wiring cors.*
/// The one origin, method and header settings.json names, and its max age.
fn policy(cors: &CorsSettings) -> Cors {
    let max_age = i32::try_from(cors.max_age_seconds).expect("settings.json's cors.maxAgeSeconds fits an i32");
    Cors::new().allow_origin(cors.origin.as_str()).allow_method(cors.method.as_str()).allow_header(cors.header.as_str()).max_age(max_age)
}
// rb:end
