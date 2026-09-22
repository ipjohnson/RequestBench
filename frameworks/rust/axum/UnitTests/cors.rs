use axum::body::Body;
use axum::http::{Request, StatusCode};

use crate::support::{app, expected, get_with, header, json, payloads, send};

fn origin() -> &'static str {
    &payloads().settings.cors.origin
}

async fn preflight(from: &str) -> axum::http::Response<Body> {
    let request = Request::options("/cors/small")
        .header("origin", from)
        .header("access-control-request-method", "GET")
        .header("access-control-request-headers", "x-rb-tenant")
        .body(Body::empty())
        .unwrap();
    send(&app(), request).await
}

// rb:test cors.preflight
/// cors.preflight: the layer answers the preflight before any handler, so no x-rb-serial.
#[tokio::test]
async fn the_layer_answers_a_preflight_before_any_handler() {
    let response = preflight(origin()).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "access-control-allow-headers"), Some("x-rb-tenant"));
    assert_eq!(header(&response, "access-control-max-age"), Some("600"));
    assert_eq!(header(&response, "x-rb-serial"), None);
}

// rb:test cors.disallowed
/// cors.disallowed: a preflight from another origin gets no access-control-allow-origin.
#[tokio::test]
async fn a_preflight_from_another_origin_is_not_allowed() {
    let response = preflight("https://elsewhere.example.net").await;

    assert_eq!(header(&response, "access-control-allow-origin"), None);
}

// rb:test cors.request,cors.vary
/// cors.request and cors.vary: the request itself reaches the handler, and the answer varies on
/// Origin.
#[tokio::test]
async fn the_request_itself_reaches_the_handler_and_varies_on_origin() {
    let response = get_with(&app(), "/cors/small", &[("origin", origin()), ("x-rb-tenant", "qwertyuiopas")]).await;

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "vary"), Some("origin"));
    assert!(header(&response, "x-rb-serial").is_some());
    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test cors.scoped
/// cors.scoped: a route outside /cors gets no policy.
#[tokio::test]
async fn a_route_outside_cors_gets_no_policy() {
    let response = get_with(&app(), "/json/small", &[("origin", origin())]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}
