use axum::routing::get;
use axum::{Json, Router};
use tower_http::validate_request::ValidateRequestHeaderLayer;

use crate::Payloads;

/// authorized: tower-http's request validation on this one route. It compares the Authorization
/// header with one bearer token before the handler runs, and refuses any other value,
/// or none, with 403.
pub fn router(p: &'static Payloads) -> Router {
    // rb:wiring authorized.*
    let bearer = ValidateRequestHeaderLayer::has_header_value("authorization", "Bearer 5a7cc77ed0dcb825806b6f872026c317")
        .expect("authorization is a header name");

    Router::new().route("/authorized/small", get(move || async move { Json(&p.small) }).layer(bearer))
}
