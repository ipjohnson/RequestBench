use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::post_json;

// rb:test errors.unmatched
/// errors.unmatched: axum's router answers a path no route matches with 404 and no body.
#[tokio::test]
async fn a_path_with_no_route_is_404() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/errors/unmatched").await;

        response.assert_status(StatusCode::NOT_FOUND);
        assert!(response.as_bytes().is_empty());
    })
    .await;
}

// rb:test errors.wrong_method
/// errors.wrong_method: axum's method router answers a method /items/{id} has no route for with 405.
#[tokio::test]
async fn a_method_with_no_route_is_405() {
    request::<App, _, _>(|server, _| async move {
        let response = server.post("/items/17").await;

        response.assert_status(StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(response.header("allow"), "GET,HEAD,PUT,PATCH,DELETE");
    })
    .await;
}

// rb:test errors.not_found
/// errors.not_found: a row items.large does not hold is Loco's not_found, 404 with its error JSON.
#[tokio::test]
async fn a_missing_row_is_loco_not_found() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/items/999999").await;

        response.assert_status(StatusCode::NOT_FOUND);
        assert_eq!(response.json::<Value>(), json!({ "error": "not_found", "description": "Resource was not found" }));
    })
    .await;
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON is refused before any rule runs, with 400 and Loco's
/// error JSON.
#[tokio::test]
async fn a_body_that_is_not_json_is_400() {
    request::<App, _, _>(|server, _| async move {
        let response = post_json(&server, "/body/validate/small", br#"{"customerId": 1, "lines": ["#.to_vec()).await;

        response.assert_status(StatusCode::BAD_REQUEST);
        assert_eq!(response.json::<Value>(), json!({ "error": "Bad Request" }));
    })
    .await;
}

#[tokio::test]
async fn a_body_that_is_json_but_not_an_order_is_422() {
    request::<App, _, _>(|server, _| async move {
        let response = post_json(&server, "/body/validate/small", br#"{"customerId":"one"}"#.to_vec()).await;

        response.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(response.json::<Value>(), json!({ "error": "Bad Request" }));
    })
    .await;
}
