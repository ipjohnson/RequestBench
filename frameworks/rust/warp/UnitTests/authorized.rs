use serde_json::json as literal;
use warp::http::StatusCode;

use crate::support::{app, expected, get_with, json};

// rb:test authorized.allowed
/// authorized.allowed: the one bearer token reaches the handler.
#[tokio::test]
async fn the_token_reaches_the_handler() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c317".to_owned();

    let response = get_with(&app(), "/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(&response), expected("items.small.json"));
}

// rb:test authorized.denied
/// authorized.denied: a token that differs in its last character is rejected before the handler
/// runs, and the recover handler answers 403 in the rejections example's form.
#[tokio::test]
async fn another_token_is_forbidden() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c310".to_owned();

    let response = get_with(&app(), "/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(json(&response), literal!({ "code": 403, "message": "FORBIDDEN" }));
}

#[tokio::test]
async fn no_token_is_forbidden() {
    let response = get_with(&app(), "/authorized/small", &[]).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
