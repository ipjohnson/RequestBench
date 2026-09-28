use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::expected;

// rb:test authorized.allowed
/// authorized.allowed: the one token reaches the handler.
#[tokio::test]
async fn the_token_reaches_the_handler() {
    request::<App, _, _>(|server, _| async move {
        let token = "5a7cc77ed0dcb825806b6f872026c317".to_owned();

        let response = server.get("/authorized/small").add_header("authorization", format!("Bearer {token}")).await;

        response.assert_status_ok();
        assert_eq!(response.json::<Value>(), expected("items.small.json"));
    })
    .await;
}

// rb:test authorized.denied
/// authorized.denied: any other token is refused with 403 and Loco's error JSON.
#[tokio::test]
async fn another_token_is_refused() {
    request::<App, _, _>(|server, _| async move {
        let wrong = "5a7cc77ed0dcb825806b6f872026c310".to_owned();

        let response = server.get("/authorized/small").add_header("authorization", format!("Bearer {wrong}")).await;

        response.assert_status(StatusCode::FORBIDDEN);
        assert_eq!(response.json::<Value>(), json!({ "error": "forbidden", "description": "The bearer token is not one this application accepts" }));
    })
    .await;
}

#[tokio::test]
async fn no_token_is_refused() {
    request::<App, _, _>(|server, _| async move {
        server.get("/authorized/small").await.assert_status(StatusCode::FORBIDDEN);
    })
    .await;
}
