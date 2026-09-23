use poem::Response;
use poem::http::{Method, StatusCode};

use crate::support::{app, expected, get_with, header, json, payloads, send};

fn origin() -> &'static str {
    &payloads().settings.cors.origin
}

async fn preflight(from: &str) -> Response {
    let headers = [("origin", from), ("access-control-request-method", "GET"), ("access-control-request-headers", "x-rb-tenant")];
    send(&app(), Method::OPTIONS, "/cors/small", &headers, None).await
}

// rb:test cors.preflight
/// cors.preflight: the middleware answers the preflight before any handler, so no x-rb-serial.
#[tokio::test]
async fn the_middleware_answers_a_preflight_before_any_handler() {
    let response = preflight(origin()).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "access-control-allow-headers"), Some("x-rb-tenant"));
    assert_eq!(header(&response, "access-control-max-age"), Some("600"));
    assert_eq!(header(&response, "x-rb-serial"), None);
}

// rb:test cors.disallowed
/// cors.disallowed: a preflight from another origin is refused with 403 and no
/// access-control-allow-origin.
#[tokio::test]
async fn a_preflight_from_another_origin_is_not_allowed() {
    let response = preflight("https://elsewhere.example.net").await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}

// rb:test cors.request
/// cors.request: the request itself reaches the handler, with the origin allowed.
#[tokio::test]
async fn the_request_itself_reaches_the_handler() {
    let response = get_with(&app(), "/cors/small", &[("origin", origin()), ("x-rb-tenant", "qwertyuiopas")]).await;

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert!(header(&response, "x-rb-serial").is_some());
    assert_eq!(json(response).await, expected("items.small.json"));
}

#[tokio::test]
async fn a_request_from_another_origin_is_refused_before_the_handler() {
    let response = get_with(&app(), "/cors/small", &[("origin", "https://elsewhere.example.net")]).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(header(&response, "x-rb-serial"), None);
}

// rb:test cors.vary
/// cors.vary, which rb.json skips: poem's Cors writes Vary: Origin only for an origin it matched by
/// a pattern or a function, never for one it lists. When it does, this fails and the skip can go.
#[tokio::test]
async fn the_answer_does_not_vary_by_origin_for_a_listed_origin() {
    let response = get_with(&app(), "/cors/small", &[("origin", origin()), ("x-rb-tenant", "qwertyuiopas")]).await;

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "vary"), None);
}

// rb:test cors.scoped
/// cors.scoped: a route outside /cors gets no policy.
#[tokio::test]
async fn a_route_outside_cors_gets_no_policy() {
    let response = get_with(&app(), "/json/small", &[("origin", origin())]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}
