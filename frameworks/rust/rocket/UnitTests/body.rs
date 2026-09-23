use rocket::http::Status;
use serde_json::{Value, json as literal};

use crate::support::{client, file, json, post};

/// The fields a refusal names, validator's own keys at the top level, sorted.
fn named(refusal: &Value) -> Vec<String> {
    let mut out: Vec<String> = refusal["errors"].as_object().unwrap().keys().cloned().collect();
    out.sort();
    out
}

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
/// body.bind_small, body.bind_medium, body.validate_small and body.validate_medium: an order is
/// answered with its leaves, its length and itself.
#[test]
fn an_order_is_answered_with_its_leaves_its_length_and_itself() {
    let client = client();
    for (path, name) in [
        ("/body/bind/small", "order.small.json"),
        ("/body/bind/medium", "order.medium.json"),
        ("/body/validate/small", "order.small.json"),
        ("/body/validate/medium", "order.medium.json"),
    ] {
        let body = file(name);
        let order: Value = serde_json::from_slice(&body).unwrap();

        let response = post(&client, path, "application/json", &body);

        assert_eq!(response.status(), Status::Ok, "{path}");
        let fields = 2 + 2 * order["lines"].as_array().unwrap().len();
        assert_eq!(json(response), literal!({ "fields": fields, "bytes": body.len(), "echo": order }), "{path}");
    }
}

// rb:test body.rejected_all
/// body.rejected_all: order.invalid breaks all three rules, and the catcher on /body names each.
#[test]
fn the_validated_guard_refuses_order_invalid_naming_every_rule_it_breaks() {
    let client = client();

    let response = post(&client, "/body/validate/small", "application/json", file("order.invalid.json"));

    assert_eq!(response.status(), Status::UnprocessableEntity);
    let refusal = json(response);
    assert_eq!(refusal["code"], 422);
    assert_eq!(named(&refusal), ["customer_id", "lines", "status"]);
}

// rb:test body.rejected_first
/// body.rejected_first: the first-error route stops at customerId, the first field Order declares.
#[test]
fn the_first_error_route_stops_at_the_first_rule() {
    let client = client();

    let response = post(&client, "/body/validate/first-error", "application/json", file("order.invalid.json"));

    assert_eq!(response.status(), Status::UnprocessableEntity);
    let refusal = json(response);
    assert_eq!(named(&refusal), ["customer_id"]);
    assert_eq!(refusal["errors"]["customer_id"][0]["code"], "range");
}

#[test]
fn a_bad_line_is_named_by_its_index() {
    let client = client();
    let body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}";

    let response = post(&client, "/body/validate/small", "application/json", body);

    assert_eq!(json(response)["errors"]["lines"]["0"]["qty"][0]["code"], "range");
}

#[test]
fn the_first_error_route_passes_a_good_order() {
    let client = client();
    let body = file("order.small.json");

    let response = post(&client, "/body/validate/first-error", "application/json", &body);

    assert_eq!(response.status(), Status::Ok);
}

#[test]
fn the_bind_routes_run_no_rule() {
    let client = client();

    let response = post(&client, "/body/bind/small", "application/json", file("order.invalid.json"));

    assert_eq!(response.status(), Status::Ok);
}

#[test]
fn a_value_of_the_wrong_type_is_refused_by_json_before_any_rule() {
    let client = client();
    for path in ["/body/validate/small", "/body/validate/first-error"] {
        let body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}";

        let response = post(&client, path, "application/json", body);

        assert_eq!(response.status(), Status::UnprocessableEntity, "{path}");
        assert_eq!(json(response)["errors"], Value::Null, "{path}");
    }
}
