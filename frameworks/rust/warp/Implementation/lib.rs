//! RequestBench target: warp. One filter per corpus family under routes/, each boxed, combined
//! with `or` into one application and recovered at the end. A family's features are filters on
//! that family's routes alone.

mod answers;
pub mod payloads;
mod refusals;
mod serial;

mod routes {
    pub mod authorized;
    pub mod baseline;
    pub mod body;
    pub mod cache;
    pub mod compressed;
    pub mod contract;
    pub mod cors;
    pub mod etag;
    pub mod forms;
    pub mod headers;
    pub mod items;
    pub mod json;
    pub mod middleware;
    pub mod parameters;
    pub mod query;
    pub mod sse;
    pub mod static_files;
    pub mod stream;
    pub mod template;
}

use warp::filters::BoxedFilter;
use warp::reply::Response;
use warp::{Filter, Rejection, Reply};

pub use payloads::Payloads;

/// One family's routes as one filter. Each is boxed, as warp's routing example suggests for an
/// application of many routes to keep compile times down. Each family tried then costs a call
/// through a pointer and an allocation for its future.
pub type Routes = BoxedFilter<(Response,)>;

/// Every route, on a filter nothing is serving yet, so the suite can hand it requests. warp tries
/// the families in this order and answers from the first whose filters all pass.
pub fn app(p: &'static Payloads) -> impl Filter<Extract = (impl Reply,), Error = Rejection> + Clone + 'static {
    routes::authorized::routes(p)
        .or(routes::baseline::routes())
        .unify()
        .or(routes::body::routes())
        .unify()
        .or(routes::cache::routes(p))
        .unify()
        .or(routes::compressed::routes(p))
        .unify()
        .or(routes::cors::routes(p))
        .unify()
        .or(routes::etag::routes(p))
        .unify()
        .or(routes::forms::routes(p))
        .unify()
        .or(routes::headers::routes(p))
        .unify()
        .or(routes::items::routes(p))
        .unify()
        .or(routes::json::routes(p))
        .unify()
        .or(routes::middleware::routes(p))
        .unify()
        .or(routes::parameters::routes(p))
        .unify()
        .or(routes::query::routes(p))
        .unify()
        .or(routes::sse::routes(p))
        .unify()
        .or(routes::static_files::routes(p))
        .unify()
        .or(routes::stream::routes(p))
        .unify()
        .or(routes::template::routes(p))
        .unify()
        .or(routes::contract::routes())
        .unify()
        .recover(refusals::recover)
}

/// A route whatever its reply, as the one answer every family's routes combine into.
fn answer<F, R>(route: F) -> impl Filter<Extract = (Response,), Error = Rejection> + Clone
where
    F: Filter<Extract = (R,), Error = Rejection> + Clone,
    R: Reply,
{
    route.map(Reply::into_response)
}
