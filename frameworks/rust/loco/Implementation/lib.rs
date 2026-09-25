//! RequestBench target: Loco. The App's Hooks in app.rs boot the application as a Loco application
//! boots, and one controller per corpus family under controllers/ adds its routes.

pub mod app;
mod answers;
pub mod payloads;
mod serial;

mod controllers {
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
    pub mod stream;
    pub mod template;
}

mod initializers {
    pub mod view_engine;
}

pub use payloads::Payloads;
