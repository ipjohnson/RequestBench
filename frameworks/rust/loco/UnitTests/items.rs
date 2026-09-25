use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::{expected, file, post_json};

fn row(id: i64) -> Value {
    expected("items.large.json")["items"].as_array().unwrap().iter().find(|row| row["id"] == id).unwrap().clone()
}

// rb:test items.create
/// items.create: 201, the row as it would be written, and where it would be.
#[tokio::test]
async fn a_new_item_is_created_after_the_last_row() {
    request::<App, _, _>(|server, _| async move {
        let response = post_json(&server, "/items", file("items.new.json")).await;

        response.assert_status(StatusCode::CREATED);
        assert_eq!(response.header("location"), "/items/1426");
        let mut created = expected("items.new.json");
        created["id"] = json!(1426);
        assert_eq!(response.json::<Value>(), created);
    })
    .await;
}

// rb:test items.read,items.head
/// items.read and items.head: the row, and for HEAD its length with no body.
#[tokio::test]
async fn a_row_is_read() {
    request::<App, _, _>(|server, _| async move {
        let read = server.get("/items/17").await;
        let head = server.method(axum::http::Method::HEAD, "/items/17").await;

        assert_eq!(read.json::<Value>(), row(17));
        head.assert_status_ok();
        assert!(head.as_bytes().is_empty());
    })
    .await;
}

// rb:test items.replace,items.update,items.delete
/// items.replace, items.update and items.delete: answered as if written, with nothing stored.
#[tokio::test]
async fn the_writes_answer_as_if_written() {
    request::<App, _, _>(|server, _| async move {
        let replaced = server.put("/items/17").json(&expected("items.new.json")).await;
        let updated = server.patch("/items/17").json(&expected("items.patch.json")).await;
        let deleted = server.delete("/items/17").await;

        let mut replacement = expected("items.new.json");
        replacement["id"] = json!(17);
        assert_eq!(replaced.json::<Value>(), replacement);
        let mut change = row(17);
        for (field, value) in expected("items.patch.json").as_object().unwrap() {
            change[field] = value.clone();
        }
        assert_eq!(updated.json::<Value>(), change);
        deleted.assert_status(StatusCode::NO_CONTENT);
        assert_eq!(server.get("/items/17").await.json::<Value>(), row(17));
    })
    .await;
}
