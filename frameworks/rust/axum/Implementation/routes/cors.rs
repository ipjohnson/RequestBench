use std::time::Duration;

use axum::http::{HeaderName, HeaderValue, Method};
use axum::routing::get;
use axum::{Json, Router};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::Payloads;
use crate::serial;

/// cors: tower-http's CORS layer on this family's router and nowhere else. It answers a preflight
/// before the router reaches a handler, so the handler's x-rb-serial is absent from it.
pub fn router(p: &'static Payloads) -> Router {
    let cors = &p.settings.cors;
    let origin = HeaderValue::from_str(&cors.origin).expect("settings.json's cors.origin is a header value");
    let method = Method::from_bytes(cors.method.as_bytes()).expect("settings.json's cors.method is a method");
    let header = HeaderName::from_bytes(cors.header.as_bytes()).expect("settings.json's cors.header is a header name");

    Router::new()
        .route("/cors/small", get(move || async move { (serial::fresh(), Json(&p.small)) }))
        // rb:wiring cors.*
        // A list rather than AllowOrigin::exact, which writes its origin on every answer, whoever
        // asks, and sends no Vary: Origin. Router::layer rather than route_layer, so the layer
        // also wraps the 405 the route answers OPTIONS with and sees the preflight.
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list([origin]))
                .allow_methods([method])
                .allow_headers([header])
                .max_age(Duration::from_secs(cors.max_age_seconds)),
        )
}
