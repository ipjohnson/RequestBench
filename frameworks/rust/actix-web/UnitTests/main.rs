//! The Implementation's routes driven in process with actix-web's own test utilities, which build
//! the App as HttpServer would and hand it requests without a socket. A test marked for corpus
//! tests names them in its doc comment, and `cargo test <function>` runs it.

mod support;

mod authorized;
mod baseline;
mod body;
mod cache;
mod compressed;
mod cors;
mod errors;
mod etag;
mod forms;
mod headers;
mod items;
mod json;
mod middleware;
mod parameters;
mod query;
mod sse;
mod static_files;
mod stream;
mod template;
