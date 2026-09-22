use axum::routing::get;
use axum::{Json, Router};

use crate::Payloads;

/// json: a payload the framework already holds, serialised at three sizes.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/json/small", get(move || async move { Json(&p.small) }))
        .route("/json/medium", get(move || async move { Json(&p.medium) }))
        .route("/json/large", get(move || async move { Json(&p.large) }))
}
