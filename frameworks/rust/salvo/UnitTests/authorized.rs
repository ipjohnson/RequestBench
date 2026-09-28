use salvo::http::StatusCode;

use crate::support::{expected, get_with, json, service, status};

// rb:test authorized.allowed
/// authorized.allowed: the one bearer token reaches the handler.
#[tokio::test]
async fn the_token_reaches_the_handler() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c317".to_owned();

    let response = get_with(&service(), "/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(status(&response), StatusCode::OK);
    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test authorized.denied
/// authorized.denied: a token that differs in its last character is refused before the handler runs.
#[tokio::test]
async fn another_token_is_forbidden() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c310".to_owned();

    let response = get_with(&service(), "/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(status(&response), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn no_token_is_forbidden() {
    let response = get_with(&service(), "/authorized/small", &[]).await;

    assert_eq!(status(&response), StatusCode::FORBIDDEN);
}
