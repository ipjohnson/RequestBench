//! The target's own suite. A test module of the binary crate, because an integration test
//! in tests/ can only reach a library's public API and this target is a binary.
mod planned;
mod floor;
mod envelope;
mod send;
mod baseline;
mod json;
mod parameters;
mod authorized;
mod etag;
mod cache;
mod body;
mod query;
mod headers;
mod domain;
mod errors;
mod template;
mod compressed;
mod middleware;
