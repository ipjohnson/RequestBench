use poem::endpoint::make_sync;
use poem::middleware::Cors;
use poem::web::Json;
use poem::{EndpointExt, Route, get};

use crate::{Payloads, serial};

/// cors: poem's CORS middleware on this family's route and nowhere else. It wraps the route's
/// method router, so it sees the preflight and answers it before any handler runs, and the
/// handler's x-rb-serial is absent from the answer.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route.at("/cors/small", get(make_sync(move |_| serial::fresh(Json(&p.small)))).with(policy()))
}

// rb:wiring cors.*
/// The one origin, method and header, and the preflight's max age.
fn policy() -> Cors {
    Cors::new().allow_origin("https://shop.example.com").allow_method("GET").allow_header("x-rb-tenant").max_age(600)
}
// rb:end
