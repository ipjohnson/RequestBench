use warp::Filter;

use crate::{Payloads, Routes, answer};

/// json: a payload the framework already holds, serialised at three sizes by warp's json reply.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler json.small,cors.scoped
    let small = warp::path!("json" / "small").and(warp::get()).map(move || warp::reply::json(&p.small));
    // rb:handler json.medium
    let medium = warp::path!("json" / "medium").and(warp::get()).map(move || warp::reply::json(&p.medium));
    // rb:handler json.large
    let large = warp::path!("json" / "large").and(warp::get()).map(move || warp::reply::json(&p.large));
    answer(small.or(medium).unify().or(large).unify()).boxed()
}
