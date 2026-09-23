use std::convert::Infallible;

use warp::reply::Response;
use warp::{Filter, Reply};

use crate::{Payloads, Routes};

/// middleware: no-op middleware between the route's path and its handler. warp's middleware is a
/// filter wrapped around another with wrap_fn, and these wrap the handler alone, so a request for
/// another path never runs them.
pub fn routes(p: &'static Payloads) -> Routes {
    let handler = move || warp::any().map(move || warp::reply::json(&p.small).into_response());
    // rb:handler middleware.none
    let none = warp::path!("middleware" / "none").and(warp::get()).and(handler());
    // rb:handler middleware.four
    let four_layers = warp::path!("middleware" / "four").and(warp::get()).and(four(handler()));
    // rb:handler middleware.sixteen
    let sixteen_layers = warp::path!("middleware" / "sixteen").and(warp::get()).and(four(four(four(four(handler())))));
    none.or(four_layers).unify().or(sixteen_layers).unify().boxed()
}

// rb:wiring middleware.*
/// One middleware: a filter in front of the one it wraps, which passes every request through.
fn noop(inner: impl Filter<Extract = (Response,), Error = Infallible> + Clone + Send + Sync) -> impl Filter<Extract = (Response,), Error = Infallible> + Clone + Send + Sync {
    warp::any().and(inner)
}

fn four(inner: impl Filter<Extract = (Response,), Error = Infallible> + Clone + Send + Sync) -> impl Filter<Extract = (Response,), Error = Infallible> + Clone + Send + Sync {
    inner.with(warp::wrap_fn(noop)).with(warp::wrap_fn(noop)).with(warp::wrap_fn(noop)).with(warp::wrap_fn(noop))
}
// rb:end
