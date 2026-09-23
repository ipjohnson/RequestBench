//! RequestBench target: actix-web. One module per corpus family under routes/, each adding its
//! routes to the application's ServiceConfig. A family's middleware wraps that family's scope or
//! resource alone.

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

use actix_web::web::ServiceConfig;

pub use payloads::Payloads;

/// Every route, as the function `App::configure` runs. HttpServer builds one App per worker
/// thread, so the response cache's stores are made here, once, and every App the function
/// configures shares them. The suite hands requests to an App it configures the same way.
pub fn routes(p: &'static Payloads) -> impl Fn(&mut ServiceConfig) + Clone + Send + 'static {
    let stores = routes::cache::Stores::new(&p.settings.cache);
    move |cfg| {
        routes::contract::configure(cfg);
        routes::authorized::configure(cfg, p);
        routes::baseline::configure(cfg);
        routes::body::configure(cfg);
        routes::cache::configure(cfg, p, &stores);
        routes::compressed::configure(cfg, p);
        routes::cors::configure(cfg, p);
        routes::etag::configure(cfg, p);
        routes::forms::configure(cfg, p);
        routes::headers::configure(cfg, p);
        routes::items::configure(cfg, p);
        routes::json::configure(cfg, p);
        routes::middleware::configure(cfg, p);
        routes::parameters::configure(cfg, p);
        routes::query::configure(cfg, p);
        routes::sse::configure(cfg, p);
        routes::static_files::configure(cfg, p);
        routes::stream::configure(cfg, p);
        routes::template::configure(cfg, p);
    }
}
