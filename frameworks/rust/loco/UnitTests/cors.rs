use axum::http::Method;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::{expected, settings};

// rb:test cors.preflight
/// cors.preflight: the layer on the cors routes answers the preflight, and no handler runs.
#[tokio::test]
async fn the_layer_answers_the_preflight() {
    request::<App, _, _>(|server, _| async move {
        let cors = settings()["cors"].clone();
        let origin = cors["origin"].as_str().unwrap().to_owned();

        let response = server
            .method(Method::OPTIONS, "/cors/small")
            .add_header("origin", origin.clone())
            .add_header("access-control-request-method", cors["method"].as_str().unwrap().to_owned())
            .add_header("access-control-request-headers", cors["header"].as_str().unwrap().to_owned())
            .await;

        response.assert_status_ok();
        assert_eq!(response.header("access-control-allow-origin"), origin.as_str());
        assert_eq!(response.header("access-control-allow-headers"), cors["header"].as_str().unwrap());
        assert_eq!(response.header("access-control-max-age"), cors["maxAgeSeconds"].to_string().as_str());
        assert_eq!(response.maybe_header("x-rb-serial"), None);
    })
    .await;
}

// rb:test cors.disallowed
/// cors.disallowed: a preflight from another origin is not allowed.
#[tokio::test]
async fn another_origin_is_not_allowed() {
    request::<App, _, _>(|server, _| async move {
        let cors = settings()["cors"].clone();

        let response = server
            .method(Method::OPTIONS, "/cors/small")
            .add_header("origin", "https://elsewhere.example.net")
            .add_header("access-control-request-method", cors["method"].as_str().unwrap().to_owned())
            .await;

        assert_eq!(response.maybe_header("access-control-allow-origin"), None);
    })
    .await;
}

// rb:test cors.request,cors.vary
/// cors.request and cors.vary: the request reaches the handler, and the answer varies on origin.
#[tokio::test]
async fn the_request_reaches_the_handler() {
    request::<App, _, _>(|server, _| async move {
        let origin = settings()["cors"]["origin"].as_str().unwrap().to_owned();

        let response = server.get("/cors/small").add_header("origin", origin.clone()).await;

        assert_eq!(response.json::<Value>(), expected("items.small.json"));
        assert_eq!(response.header("access-control-allow-origin"), origin.as_str());
        assert!(response.headers().get_all("vary").iter().any(|v| v.to_str().unwrap().split(", ").any(|name| name == "origin")));
        assert!(response.maybe_header("x-rb-serial").is_some());
    })
    .await;
}

// rb:test cors.scoped
/// cors.scoped: a route outside /cors gets no CORS headers, because the layer is on the cors routes
/// alone.
#[tokio::test]
async fn a_route_outside_cors_gets_no_policy() {
    request::<App, _, _>(|server, _| async move {
        let origin = settings()["cors"]["origin"].as_str().unwrap().to_owned();

        let response = server.get("/json/small").add_header("origin", origin).await;

        response.assert_status_ok();
        assert_eq!(response.maybe_header("access-control-allow-origin"), None);
    })
    .await;
}
