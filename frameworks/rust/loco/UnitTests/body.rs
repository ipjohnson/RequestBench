use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::{file, post_json};

/// The fields a refusal names, the validator's keys, sorted.
fn named(refusal: &Value) -> Vec<String> {
    let mut out: Vec<String> = refusal["errors"].as_object().unwrap().keys().cloned().collect();
    out.sort();
    out
}

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
/// body.bind_small, body.bind_medium, body.validate_small and body.validate_medium: an order is
/// answered with its leaves, its length and itself.
#[tokio::test]
async fn an_order_is_answered_with_its_leaves_its_length_and_itself() {
    request::<App, _, _>(|server, _| async move {
        for (path, name) in [
            ("/body/bind/small", "order.small.json"),
            ("/body/bind/medium", "order.medium.json"),
            ("/body/validate/small", "order.small.json"),
            ("/body/validate/medium", "order.medium.json"),
        ] {
            let body = file(name);
            let order: Value = serde_json::from_slice(&body).unwrap();

            let response = post_json(&server, path, body.clone()).await;

            assert_eq!(response.status_code(), StatusCode::OK, "{path}");
            let fields = 2 + 2 * order["lines"].as_array().unwrap().len();
            assert_eq!(response.json::<Value>(), json!({ "fields": fields, "bytes": body.len(), "echo": order }), "{path}");
        }
    })
    .await;
}

// rb:test body.rejected_all
/// body.rejected_all: order.invalid breaks all three rules, and JsonValidateWithMessage refuses it
/// naming each.
#[tokio::test]
async fn the_validate_route_refuses_order_invalid_naming_every_rule_it_breaks() {
    request::<App, _, _>(|server, _| async move {
        let response = post_json(&server, "/body/validate/small", file("order.invalid.json")).await;

        response.assert_status(StatusCode::BAD_REQUEST);
        assert_eq!(named(&response.json::<Value>()), ["customer_id", "lines", "status"]);
    })
    .await;
}

// rb:test body.rejected_first
/// body.rejected_first: the first-error route stops at customerId, the first field Order declares.
#[tokio::test]
async fn the_first_error_route_stops_at_the_first_rule() {
    request::<App, _, _>(|server, _| async move {
        let response = post_json(&server, "/body/validate/first-error", file("order.invalid.json")).await;

        response.assert_status(StatusCode::BAD_REQUEST);
        let refusal = response.json::<Value>();
        assert_eq!(named(&refusal), ["customer_id"]);
        assert_eq!(refusal["errors"]["customer_id"][0]["code"], "range");
    })
    .await;
}

#[tokio::test]
async fn a_bad_line_is_refused_naming_no_field() {
    request::<App, _, _>(|server, _| async move {
        let body = br#"{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"#.to_vec();

        let response = post_json(&server, "/body/validate/small", body).await;

        // Loco turns validator's errors into its own with field_errors, which leaves out a nested
        // struct's and a list entry's.
        response.assert_status(StatusCode::BAD_REQUEST);
        assert_eq!(response.json::<Value>(), json!({ "errors": {} }));
    })
    .await;
}
