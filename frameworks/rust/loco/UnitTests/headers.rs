use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::{expected, with_echo};

// rb:test headers.few,headers.many
/// headers.few and headers.many: the headers are sent and nothing reads them.
#[tokio::test]
async fn unread_headers_change_nothing() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/headers").add_header("x-rb-extra", "value").await;

        assert_eq!(response.json::<Value>(), expected("items.small.json"));
    })
    .await;
}

// rb:test headers.bind_few,headers.bind_many
/// headers.bind_few and headers.bind_many: three headers read, the account as an integer.
#[tokio::test]
async fn three_headers_are_bound() {
    request::<App, _, _>(|server, _| async move {
        let response = server
            .get("/headers/bind")
            .add_header("x-rb-tenant", "qwertyuiopas")
            .add_header("x-rb-request-id", "0123456789abcdef")
            .add_header("x-rb-account", "482913")
            .await;

        let echo = json!({ "tenant": "qwertyuiopas", "requestId": "0123456789abcdef", "account": 482913 });
        assert_eq!(response.json::<Value>(), with_echo("items.small.json", echo));
    })
    .await;
}

#[tokio::test]
async fn a_missing_header_is_loco_bad_request() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/headers/bind").add_header("x-rb-tenant", "qwertyuiopas").await;

        response.assert_status(StatusCode::BAD_REQUEST);
        assert_eq!(response.json::<Value>()["error"], "Bad Request");
    })
    .await;
}
