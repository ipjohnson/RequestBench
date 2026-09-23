//! RequestBench target: Salvo. One router per corpus family under routes/, pushed into one
//! service. Each family's hoops sit on that family's router alone.

mod answers;
pub mod payloads;
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

use salvo::prelude::*;

pub use payloads::Payloads;

/// Every route, in a service nothing is serving yet, so the suite can hand it requests. Salvo
/// tries a router's children in the order they were pushed, so each family is one child, named by
/// the first segment of its paths, in alphabetical order, and the two routes outside the corpus
/// come last.
pub fn service(p: &'static Payloads) -> Service {
    let router = Router::new()
        .push(routes::authorized::router(p))
        .push(routes::baseline::router())
        .push(routes::body::router())
        .push(routes::cache::router(p))
        .push(routes::compressed::router(p))
        .push(routes::cors::router(p))
        .push(routes::etag::router(p))
        .push(routes::forms::router(p))
        .push(routes::headers::router(p))
        .push(routes::items::router(p))
        .push(routes::json::router(p))
        .push(routes::middleware::router(p))
        .push(routes::parameters::router(p))
        .push(routes::query::router(p))
        .push(routes::sse::router(p))
        .push(routes::static_files::router(p))
        .push(routes::stream::router(p))
        .push(routes::template::router(p))
        .push(routes::contract::router());
    Service::new(router)
}
