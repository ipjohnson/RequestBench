use axum::routing::get;
use axum::{Json, Router};
use tower_http::validate_request::ValidateRequestHeaderLayer;

use crate::Payloads;

/// authorized: tower-http's request validation on this one route. It compares the Authorization
/// header with settings.json's bearer token before the handler runs, and refuses any other value,
/// or none, with 403.
pub fn router(p: &'static Payloads) -> Router {
    // rb:wiring authorized.*
    let bearer = ValidateRequestHeaderLayer::has_header_value("authorization", &format!("Bearer {}", p.settings.token))
        .expect("authorization is a header name");

    Router::new().route("/authorized/small", get(move || async move { Json(&p.small) }).layer(bearer))
}
