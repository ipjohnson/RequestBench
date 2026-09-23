//! RequestBench target: poem. One module per corpus family under routes/, each adding its routes to
//! the one Route the application is. Each family's middleware is on that family's routes alone.

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

use poem::Route;

pub use payloads::Payloads;

/// The payloads as a handler function reads them. A handler function captures nothing, so the
/// routes whose handlers take extractors put this on the request with poem's AddData, and the
/// handler reads it back with the Data extractor.
type Shared = &'static Payloads;

/// Every route, on a Route nothing is serving yet, so the suite can hand it requests. poem's Route
/// holds each path once, so every family adds its paths to the same one.
pub fn app(p: &'static Payloads) -> Route {
    let families: [fn(Route, &'static Payloads) -> Route; 19] = [
        routes::contract::add,
        routes::authorized::add,
        routes::baseline::add,
        routes::body::add,
        routes::cache::add,
        routes::compressed::add,
        routes::cors::add,
        routes::etag::add,
        routes::forms::add,
        routes::headers::add,
        routes::items::add,
        routes::json::add,
        routes::middleware::add,
        routes::parameters::add,
        routes::query::add,
        routes::sse::add,
        routes::static_files::add,
        routes::stream::add,
        routes::template::add,
    ];
    families.iter().fold(Route::new(), |route, add| add(route, p))
}
