use salvo::http::StatusCode;
use serde_json::{Value, json as literal};

use crate::support::{file, header, json, post, service, status};

/// The fields a refusal names, validator's own keys at each level, sorted.
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
    for (path, name) in [
        ("/body/bind/small", "order.small.json"),
        ("/body/bind/medium", "order.medium.json"),
        ("/body/validate/small", "order.small.json"),
        ("/body/validate/medium", "order.medium.json"),
    ] {
        let body = file(name);
        let order: Value = serde_json::from_slice(&body).unwrap();

        let response = post(&service(), path, "application/json", body.clone()).await;

        assert_eq!(status(&response), StatusCode::OK, "{path}");
        let fields = 2 + 2 * order["lines"].as_array().unwrap().len();
        assert_eq!(json(response).await, literal!({ "fields": fields, "bytes": body.len(), "echo": order }), "{path}");
    }
}

// rb:test body.rejected_all
/// body.rejected_all: order.invalid breaks all three rules, and the refusal is Salvo's problem
/// details, naming each field in validator's errors.
#[tokio::test]
async fn order_invalid_is_a_problem_naming_every_rule_it_breaks() {
    let response = post(&service(), "/body/validate/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(status(&response), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(header(&response, "content-type"), Some("application/problem+json"));
    let refusal = json(response).await;
    assert_eq!(refusal["type"], "about:blank");
    assert_eq!(refusal["status"], 422);
    assert_eq!(named(&refusal), ["customer_id", "lines", "status"]);
}

// rb:test body.rejected_first
/// body.rejected_first: the first-error route stops at customerId, the first field Order declares.
#[tokio::test]
async fn the_first_error_route_stops_at_the_first_rule() {
    let response = post(&service(), "/body/validate/first-error", "application/json", file("order.invalid.json")).await;

    assert_eq!(status(&response), StatusCode::UNPROCESSABLE_ENTITY);
    let refusal = json(response).await;
    assert_eq!(named(&refusal), ["customer_id"]);
    assert_eq!(refusal["errors"]["customer_id"][0]["code"], "range");
}

#[tokio::test]
async fn a_bad_line_is_named_by_its_index() {
    let body = literal!({ "customerId": 1, "status": "open", "lines": [{ "productId": 1, "qty": 0 }] }).to_string();

    let response = post(&service(), "/body/validate/small", "application/json", body).await;

    assert_eq!(json(response).await["errors"]["lines"]["0"]["qty"][0]["code"], "range");
}

#[tokio::test]
async fn the_bind_routes_run_no_rule() {
    let response = post(&service(), "/body/bind/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(status(&response), StatusCode::OK);
}

#[tokio::test]
async fn a_value_of_the_wrong_type_is_refused_by_parse_json_before_any_rule() {
    for path in ["/body/validate/small", "/body/validate/first-error"] {
        let body = literal!({ "customerId": "not-an-int", "status": 42, "lines": "nope" }).to_string();

        let response = post(&service(), path, "application/json", body).await;

        assert_eq!(status(&response), StatusCode::BAD_REQUEST, "{path}");
    }
}
