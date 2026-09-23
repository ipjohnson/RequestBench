use rocket::http::Status;
use serde_json::json as literal;

use crate::support::{client, expected, get, json, with_echo};

// rb:test parameters.static
/// parameters.static: four literal segments and no capture.
#[test]
fn the_static_route_answers_the_payload() {
    let client = client();

    let response = get(&client, "/parameters/static/segment/literal", &[]);

    assert_eq!(json(response), expected("items.small.json"));
}

// rb:test parameters.one,parameters.two
/// parameters.one and parameters.two: each capture bound as an integer and echoed.
#[test]
fn captures_are_bound_as_integers() {
    let client = client();

    let one = get(&client, "/parameters/4821/segment/literal", &[]);
    assert_eq!(json(one), with_echo("items.small.json", literal!({ "one": 4821 })));

    let two = get(&client, "/parameters/4821/with-second/7390", &[]);
    assert_eq!(json(two), with_echo("items.small.json", literal!({ "one": 4821, "two": 7390 })));
}

#[test]
fn a_capture_that_is_not_an_integer_is_422() {
    let client = client();

    let response = get(&client, "/parameters/many/segment/literal", &[]);

    assert_eq!(response.status(), Status::UnprocessableEntity);
}
