use actix_web::http::StatusCode;

use crate::support::{app, expected, header, json};

// rb:test authorized.allowed
/// authorized.allowed: the one bearer token reaches the handler.
#[actix_web::test]
async fn the_token_reaches_the_handler() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c317".to_owned();

    let response = app().await.get_with("/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await, expected("items.small.json"));
}

// rb:test authorized.denied
/// authorized.denied: a token that differs in its last character is refused by the validator with
/// 403 before the handler runs.
#[actix_web::test]
async fn another_token_is_forbidden() {
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c310".to_owned();

    let response = app().await.get_with("/authorized/small", &[("authorization", &token)]).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[actix_web::test]
async fn no_token_is_refused_by_the_extractor_with_401() {
    let response = app().await.get("/authorized/small").await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(header(&response, "www-authenticate"), Some("Bearer"));
}
