use serde_json::{Value, json as literal};
use warp::http::StatusCode;

use crate::support::{app, file, json, post};

/// The fields validator's report names, by their Rust names, sorted: the text before each entry's
/// first colon.
fn named(refusal: &Value) -> Vec<String> {
    let message = refusal["message"].as_str().expect("the refusal carries a message");
    let mut out: Vec<String> = message.lines().map(|line| line.split(": ").next().unwrap().to_owned()).collect();
    out.sort();
    out
}

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
/// body.bind_small, body.bind_medium, body.validate_small and body.validate_medium: an order is
/// answered with its leaves, its length and itself.
#[tokio::test]
async fn an_order_is_answered_with_its_leaves_its_length_and_itself() {
    for (path, name) in [
        ("/body/bind/small", "order.small.json"),
        ("/body/bind/medium", "order.medium.json"),
        ("/body/validate/small", "order.small.json"),
        ("/body/validate/medium", "order.medium.json"),
    ] {
        let body = file(name);
        let order: Value = serde_json::from_slice(&body).unwrap();

        let response = post(&app(), path, "application/json", &body).await;

        assert_eq!(response.status(), StatusCode::OK, "{path}");
        let fields = 2 + 2 * order["lines"].as_array().unwrap().len();
        assert_eq!(json(&response), literal!({ "fields": fields, "bytes": body.len(), "echo": order }), "{path}");
    }
}

// rb:test body.rejected_all
/// body.rejected_all: order.invalid breaks all three rules, and the recover handler answers 400
/// with validator's report naming each.
#[tokio::test]
async fn validator_refuses_order_invalid_naming_every_rule_it_breaks() {
    let response = post(&app(), "/body/validate/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let refusal = json(&response);
    assert_eq!(refusal["code"], 400);
    assert_eq!(named(&refusal), ["customer_id", "lines", "status"]);
}

// rb:test body.rejected_first
/// body.rejected_first: the first-error route stops at customerId, the first field Order declares.
#[tokio::test]
async fn the_first_error_route_stops_at_the_first_rule() {
    let response = post(&app(), "/body/validate/first-error", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let refusal = json(&response);
    assert_eq!(named(&refusal), ["customer_id"]);
    assert!(refusal["message"].as_str().unwrap().starts_with("customer_id: Validation error: range "));
}

#[tokio::test]
async fn a_bad_line_is_named_by_its_index() {
    let body = r#"{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"#;

    let response = post(&app(), "/body/validate/small", "application/json", body).await;

    assert!(json(&response)["message"].as_str().unwrap().starts_with("lines[0].qty: Validation error: range "));
}

#[tokio::test]
async fn the_bind_routes_run_no_rule() {
    let response = post(&app(), "/body/bind/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn a_value_of_the_wrong_type_is_refused_by_the_body_filter_before_any_rule() {
    for path in ["/body/validate/small", "/body/validate/first-error"] {
        let body = r#"{"customerId":"not-an-int","status":42,"lines":"nope"}"#;

        let response = post(&app(), path, "application/json", body).await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{path}");
        assert!(response.body().starts_with(b"Request body deserialize error: "), "{path}");
    }
}
