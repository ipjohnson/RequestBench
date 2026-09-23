use salvo::http::StatusCode;
use serde_json::json as literal;

use crate::support::{expected, get, json, service, status, with_echo};

// rb:test parameters.static
/// parameters.static: four literal segments and no capture.
#[tokio::test]
async fn the_static_route_answers_the_payload() {
    let response = get(&service(), "/parameters/static/segment/literal").await;

    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test parameters.one,parameters.two
/// parameters.one and parameters.two: each capture bound as an integer and echoed.
#[tokio::test]
async fn captures_are_bound_as_integers() {
    let one = get(&service(), "/parameters/4821/segment/literal").await;
    let two = get(&service(), "/parameters/4821/with-second/7390").await;

    assert_eq!(json(one).await, with_echo("items.small.json", literal!({ "one": 4821 })));
    assert_eq!(json(two).await, with_echo("items.small.json", literal!({ "one": 4821, "two": 7390 })));
}

#[tokio::test]
async fn a_capture_that_is_not_an_integer_is_400() {
    let response = get(&service(), "/parameters/many/segment/literal").await;

    assert_eq!(status(&response), StatusCode::BAD_REQUEST);
}
