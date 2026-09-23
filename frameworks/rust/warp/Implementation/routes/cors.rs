use std::time::Duration;

use warp::Filter;

use crate::{Payloads, Routes, answer, serial};

/// cors: warp's cors filter on this family's route and nowhere else. The route's path is matched
/// first, and the filter answers a preflight there before the handler, so the handler's
/// x-rb-serial is absent from it.
pub fn routes(p: &'static Payloads) -> Routes {
    let cors = &p.settings.cors;
    // rb:wiring cors.*
    let policy = warp::cors().allow_origin(cors.origin.as_str()).allow_method(cors.method.as_str()).allow_header(cors.header.as_str()).max_age(Duration::from_secs(cors.max_age_seconds));

    // rb:handler cors.request
    answer(warp::path!("cors" / "small").and(warp::get().map(move || serial::fresh(warp::reply::json(&p.small))).with(policy))).boxed()
}
