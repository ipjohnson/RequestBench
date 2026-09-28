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
    Router::new()
        .route("/cors/small", get(move || async move { (serial::fresh(), Json(&p.small)) }))
        // rb:wiring cors.*
        // A list rather than AllowOrigin::exact, which writes its origin on every answer, whoever
        // asks, and sends no Vary: Origin. Router::layer rather than route_layer, so the layer
        // also wraps the 405 the route answers OPTIONS with and sees the preflight.
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list([HeaderValue::from_static("https://shop.example.com")]))
                .allow_methods([Method::GET])
                .allow_headers([HeaderName::from_static("x-rb-tenant")])
                .max_age(Duration::from_secs(600)),
        )
}
