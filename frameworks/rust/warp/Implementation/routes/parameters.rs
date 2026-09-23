use serde::Serialize;
use warp::Filter;

use crate::answers::Echoed;
use crate::{Payloads, Routes, answer};

#[derive(Serialize)]
struct One {
    one: i64,
}

#[derive(Serialize)]
struct Two {
    one: i64,
    two: i64,
}

/// parameters: path captures, each converted to an integer by warp's path filter with FromStr. A
/// segment that does not convert is a route that does not match, so "static" never reaches the
/// capture beside it.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler parameters.static
    let fixed = warp::path!("parameters" / "static" / "segment" / "literal").and(warp::get()).map(move || warp::reply::json(&p.small));
    // rb:handler parameters.one
    let one = warp::path!("parameters" / i64 / "segment" / "literal").and(warp::get()).map(move |one| warp::reply::json(&Echoed::new(&p.small, One { one })));
    // rb:handler parameters.two
    let two = warp::path!("parameters" / i64 / "with-second" / i64).and(warp::get()).map(move |one, two| warp::reply::json(&Echoed::new(&p.small, Two { one, two })));
    answer(fixed.or(one).unify().or(two).unify()).boxed()
}
