use salvo::http::StatusCode;
use salvo::prelude::*;
use salvo::test::TestClient;

use crate::support::{expected, get_with, header, json, payloads, send, service, status, url, with_headers};

fn origin() -> &'static str {
    &payloads().settings.cors.origin
}

async fn preflight(from: &str) -> Response {
    let request = TestClient::options(url("/cors/small"));
    send(&service(), with_headers(request, &[("origin", from), ("access-control-request-method", "GET"), ("access-control-request-headers", "x-rb-tenant")])).await
}

// rb:test cors.preflight
/// cors.preflight: the hoop answers the preflight after the route's empty OPTIONS goal, so no
/// x-rb-serial.
#[tokio::test]
async fn the_hoop_answers_a_preflight_without_the_handler() {
    let response = preflight(origin()).await;

    assert_eq!(status(&response), StatusCode::NO_CONTENT);
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
    let response = get_with(&service(), "/cors/small", &[("origin", origin()), ("x-rb-tenant", "qwertyuiopas")]).await;

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert!(response.headers().get_all("vary").iter().any(|value| value == "origin"));
    assert!(header(&response, "x-rb-serial").is_some());
    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test cors.scoped
/// cors.scoped: a route outside /cors gets no policy.
#[tokio::test]
async fn a_route_outside_cors_gets_no_policy() {
    let response = get_with(&service(), "/json/small", &[("origin", origin())]).await;

    assert_eq!(status(&response), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}
