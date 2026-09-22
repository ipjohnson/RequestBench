use axum::Router;
use axum::routing::get;

/// baseline: the dispatch floor, with nothing serialised.
pub fn router() -> Router {
    Router::new().route("/plaintext", get(|| async { "Hello, World!" }))
}
