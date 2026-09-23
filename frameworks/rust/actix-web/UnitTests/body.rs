use actix_web::http::StatusCode;
use serde_json::{Value, json as literal};

use crate::support::{app, bytes, file, json};

/// The fields a refusal names, validator's own keys at each level, sorted.
fn named(refusal: &Value) -> Vec<String> {
    let mut out: Vec<String> = refusal.as_object().unwrap().keys().cloned().collect();
    out.sort();
    out
}

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
/// body.bind_small, body.bind_medium, body.validate_small and body.validate_medium: an order is
/// answered with its leaves, its length and itself.
#[actix_web::test]
async fn an_order_is_answered_with_its_leaves_its_length_and_itself() {
    let app = app().await;
    for (path, name) in [
        ("/body/bind/small", "order.small.json"),
        ("/body/bind/medium", "order.medium.json"),
        ("/body/validate/small", "order.small.json"),
        ("/body/validate/medium", "order.medium.json"),
    ] {
        let body = file(name);
        let order: Value = serde_json::from_slice(&body).unwrap();

        let response = app.post(path, "application/json", body.clone()).await;

        assert_eq!(response.status(), StatusCode::OK, "{path}");
        let fields = 2 + 2 * order["lines"].as_array().unwrap().len();
        assert_eq!(json(response).await, literal!({ "fields": fields, "bytes": body.len(), "echo": order }), "{path}");
    }
}

// rb:test body.rejected_all
/// body.rejected_all: order.invalid breaks all three rules, and the refusal names each, as JSON.
#[actix_web::test]
async fn order_invalid_is_refused_naming_every_rule_it_breaks() {
    let response = app().await.post("/body/validate/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(named(&json(response).await), ["customer_id", "lines", "status"]);
}

// rb:test body.rejected_first
/// body.rejected_first: the first-error route stops at customerId, the first field Order declares.
#[actix_web::test]
async fn the_first_error_route_stops_at_the_first_rule() {
    let response = app().await.post("/body/validate/first-error", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let refusal = json(response).await;
    assert_eq!(named(&refusal), ["customer_id"]);
    assert_eq!(refusal["customer_id"][0]["code"], "range");
}

#[actix_web::test]
async fn a_bad_line_is_named_by_its_index() {
    let body = r#"{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"#;

    let response = app().await.post("/body/validate/small", "application/json", body).await;

    assert_eq!(json(response).await["lines"]["0"]["qty"][0]["code"], "range");
}

#[actix_web::test]
async fn the_bind_routes_run_no_rule() {
    let response = app().await.post("/body/bind/small", "application/json", file("order.invalid.json")).await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[actix_web::test]
async fn a_value_of_the_wrong_type_is_refused_by_the_extractor_before_any_rule() {
    let app = app().await;
    for (path, text) in [("/body/validate/small", "Payload error: Json deserialize error: "), ("/body/validate/first-error", "Json deserialize error: ")] {
        let body = r#"{"customerId":"not-an-int","status":42,"lines":"nope"}"#;

        let response = app.post(path, "application/json", body).await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{path}");
        assert!(bytes(response).await.starts_with(text.as_bytes()), "{path}");
    }
}
