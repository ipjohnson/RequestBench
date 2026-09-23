use std::time::Duration;

use salvo::cors::Cors;
use salvo::http::Method;
use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Stamped;

/// cors: salvo-cors's hoop on this family's router and nowhere else. It answers a preflight after
/// the route's OPTIONS goal, which is Salvo's empty handler, so the handler's x-rb-serial is absent
/// from it.
pub fn router(p: &'static Payloads) -> Router {
    let cors = &p.settings.cors;
    let method = Method::from_bytes(cors.method.as_bytes()).expect("settings.json's cors.method is a method");

    Router::with_path("/cors/small").get(Stamped(&p.small))
        // rb:wiring cors.*
        // A list of one rather than the origin alone, which salvo-cors takes as an exact origin and
        // writes on every answer, whoever asks. Salvo's documentation hoops the CORS handler on the
        // whole service, because a preflight has to reach it. Here an OPTIONS goal on the route
        // gives the preflight a route to match, so the policy stays on /cors.
        .hoop(Cors::new().allow_origin([cors.origin.as_str()]).allow_methods(method).allow_headers(cors.header.as_str()).max_age(Duration::from_secs(cors.max_age_seconds)).into_handler())
        .options(salvo::handler::empty())
    // rb:end
}
