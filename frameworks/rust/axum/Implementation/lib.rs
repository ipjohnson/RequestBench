//! RequestBench target: axum. One router per corpus family under routes/, merged into one
//! application. Each family's features are tower layers on that family's router alone.

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

use axum::Router;

pub use payloads::Payloads;

/// Every route, on a router nothing is serving yet, so the suite can hand it requests.
pub fn app(p: &'static Payloads) -> Router {
    Router::new()
        .merge(routes::contract::router())
        .merge(routes::authorized::router(p))
        .merge(routes::baseline::router())
        .merge(routes::body::router())
        .merge(routes::cache::router(p))
        .merge(routes::compressed::router(p))
        .merge(routes::cors::router(p))
        .merge(routes::etag::router(p))
        .merge(routes::forms::router(p))
        .merge(routes::headers::router(p))
        .merge(routes::items::router(p))
        .merge(routes::json::router(p))
        .merge(routes::middleware::router(p))
        .merge(routes::parameters::router(p))
        .merge(routes::query::router(p))
        .merge(routes::sse::router(p))
        .merge(routes::static_files::router(p))
        .merge(routes::stream::router(p))
        .merge(routes::template::router(p))
}
