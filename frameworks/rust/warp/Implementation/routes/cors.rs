use std::time::Duration;

use warp::Filter;

use crate::{Payloads, Routes, answer, serial};

/// cors: warp's cors filter on this family's route and nowhere else. The route's path is matched
/// first, and the filter answers a preflight there before the handler, so the handler's
/// x-rb-serial is absent from it.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:wiring cors.*
    let policy = warp::cors().allow_origin("https://shop.example.com").allow_method("GET").allow_header("x-rb-tenant").max_age(Duration::from_secs(600));

    // rb:handler cors.request
    answer(warp::path!("cors" / "small").and(warp::get().map(move || serial::fresh(warp::reply::json(&p.small))).with(policy))).boxed()
}
