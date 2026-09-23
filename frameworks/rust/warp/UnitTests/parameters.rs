use serde_json::json as literal;
use warp::http::StatusCode;

use crate::support::{app, expected, get, json, with_echo};

// rb:test parameters.static
/// parameters.static: four literal segments and no capture.
#[tokio::test]
async fn the_static_route_answers_the_payload() {
    let response = get(&app(), "/parameters/static/segment/literal").await;

    assert_eq!(json(&response), expected("items.small.json"));
}

// rb:test parameters.one,parameters.two
/// parameters.one and parameters.two: each capture bound as an integer and echoed.
#[tokio::test]
async fn captures_are_bound_as_integers() {
    let one = get(&app(), "/parameters/4821/segment/literal").await;
    let two = get(&app(), "/parameters/4821/with-second/7390").await;

    assert_eq!(json(&one), with_echo("items.small.json", literal!({ "one": 4821 })));
    assert_eq!(json(&two), with_echo("items.small.json", literal!({ "one": 4821, "two": 7390 })));
}

#[tokio::test]
async fn a_capture_that_is_not_an_integer_is_a_route_that_does_not_match() {
    let response = get(&app(), "/parameters/many/segment/literal").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
