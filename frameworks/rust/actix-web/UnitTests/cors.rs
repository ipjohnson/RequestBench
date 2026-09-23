use actix_web::body::MessageBody;
use actix_web::dev::ServiceResponse;
use actix_web::http::StatusCode;
use actix_web::test::TestRequest;

use crate::support::{app, expected, header, json, payloads};

fn origin() -> &'static str {
    &payloads().settings.cors.origin
}

async fn preflight(from: &str) -> ServiceResponse<impl MessageBody> {
    let request = TestRequest::default()
        .method(actix_web::http::Method::OPTIONS)
        .uri("/cors/small")
        .insert_header(("origin", from))
        .insert_header(("access-control-request-method", "GET"))
        .insert_header(("access-control-request-headers", "x-rb-tenant"));
    app().await.send(request).await
}

// rb:test cors.preflight
/// cors.preflight: the middleware answers the preflight before any handler, so no x-rb-serial.
#[actix_web::test]
async fn the_middleware_answers_a_preflight_before_any_handler() {
    let response = preflight(origin()).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "access-control-allow-headers"), Some("x-rb-tenant"));
    assert_eq!(header(&response, "access-control-max-age"), Some("600"));
    assert_eq!(header(&response, "x-rb-serial"), None);
}

// rb:test cors.disallowed
/// cors.disallowed: a preflight from another origin gets no access-control-allow-origin, and
/// actix-cors refuses it with 400.
#[actix_web::test]
async fn a_preflight_from_another_origin_is_not_allowed() {
    let response = preflight("https://elsewhere.example.net").await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}

// rb:test cors.request,cors.vary
/// cors.request and cors.vary: the request itself reaches the handler, and the answer varies on
/// Origin.
#[actix_web::test]
async fn the_request_itself_reaches_the_handler_and_varies_on_origin() {
    let response = app().await.get_with("/cors/small", &[("origin", origin()), ("x-rb-tenant", "qwertyuiopas")]).await;

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "vary"), Some("Origin, Access-Control-Request-Method, Access-Control-Request-Headers"));
    assert!(header(&response, "x-rb-serial").is_some());
    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test cors.scoped
/// cors.scoped: a route outside /cors gets no policy.
#[actix_web::test]
async fn a_route_outside_cors_gets_no_policy() {
    let response = app().await.get_with("/json/small", &[("origin", origin())]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}
