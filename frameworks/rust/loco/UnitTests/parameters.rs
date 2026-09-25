use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::{expected, with_echo};

// rb:test parameters.static
/// parameters.static: the literal path, which no capture takes.
#[tokio::test]
async fn the_literal_path_is_its_own_route() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/parameters/static/segment/literal").await;

        assert_eq!(response.json::<Value>(), expected("items.small.json"));
    })
    .await;
}

// rb:test parameters.one,parameters.two
/// parameters.one and parameters.two: each capture bound as an integer and echoed.
#[tokio::test]
async fn each_capture_is_an_integer() {
    request::<App, _, _>(|server, _| async move {
        let one = server.get("/parameters/4821/segment/literal").await;
        let two = server.get("/parameters/4821/with-second/7390").await;

        assert_eq!(one.json::<Value>(), with_echo("items.small.json", json!({ "one": 4821 })));
        assert_eq!(two.json::<Value>(), with_echo("items.small.json", json!({ "one": 4821, "two": 7390 })));
    })
    .await;
}

#[tokio::test]
async fn a_capture_that_is_no_integer_is_refused() {
    request::<App, _, _>(|server, _| async move {
        server.get("/parameters/abc/segment/literal").await.assert_status(StatusCode::BAD_REQUEST);
    })
    .await;
}
