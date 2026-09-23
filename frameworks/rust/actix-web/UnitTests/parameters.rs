use actix_web::http::StatusCode;
use serde_json::json as literal;

use crate::support::{app, expected, json, with_echo};

// rb:test parameters.static
/// parameters.static: four literal segments and no capture.
#[actix_web::test]
async fn the_static_route_answers_the_payload() {
    let response = app().await.get("/parameters/static/segment/literal").await;

    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test parameters.one,parameters.two
/// parameters.one and parameters.two: each capture bound as an integer and echoed.
#[actix_web::test]
async fn captures_are_bound_as_integers() {
    let app = app().await;

    let one = app.get("/parameters/4821/segment/literal").await;
    let two = app.get("/parameters/4821/with-second/7390").await;

    assert_eq!(json(one).await, with_echo("items.small.json", literal!({ "one": 4821 })));
    assert_eq!(json(two).await, with_echo("items.small.json", literal!({ "one": 4821, "two": 7390 })));
}

#[actix_web::test]
async fn a_capture_that_is_not_an_integer_is_404() {
    let response = app().await.get("/parameters/many/segment/literal").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
