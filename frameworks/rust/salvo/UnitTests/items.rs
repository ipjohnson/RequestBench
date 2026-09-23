use salvo::http::StatusCode;
use salvo::prelude::*;
use salvo::test::TestClient;
use serde_json::{Value, json as literal};

use crate::support::{bytes, expected, file, get, header, json, post, send, service, status, url, with_body};

/// Row `id` of items.large.
fn row(id: usize) -> Value {
    expected("items.large.json")["items"][id - 1].clone()
}

/// items.new under this id.
fn replaced(id: u64) -> Value {
    let mut item = expected("items.new.json");
    item["id"] = literal!(id);
    item
}

// rb:test items.read
/// items.read: the row with the id in the path.
#[tokio::test]
async fn a_row_is_read_by_its_id() {
    let response = get(&service(), "/items/17").await;

    assert_eq!(status(&response), StatusCode::OK);
    assert_eq!(json(response).await, row(17));
}

// rb:test items.head
/// items.head: HEAD is answered by the read handler, registered for HEAD, with its type and no body.
#[tokio::test]
async fn head_is_the_read_handler_with_no_body() {
    let response = send(&service(), TestClient::head(url("/items/17"))).await;

    assert_eq!(status(&response), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
    assert!(bytes(response).await.is_empty());
}

// rb:test items.create
/// items.create: 201, where the item would live, and the item under the id after the last row.
#[tokio::test]
async fn a_new_item_is_created_after_the_last_row() {
    let response = post(&service(), "/items", "application/json", file("items.new.json")).await;

    assert_eq!(status(&response), StatusCode::CREATED);
    assert_eq!(header(&response, "location"), Some("/items/1426"));
    assert_eq!(json(response).await, replaced(1426));
}

async fn with_json(request: salvo::test::RequestBuilder, name: &str) -> Response {
    send(&service(), with_body(request, "application/json", file(name))).await
}

// rb:test items.replace
/// items.replace: the whole item put at the id in the path.
#[tokio::test]
async fn an_item_is_replaced_at_its_id() {
    let response = with_json(TestClient::put(url("/items/17")), "items.new.json").await;

    assert_eq!(status(&response), StatusCode::OK);
    assert_eq!(json(response).await, replaced(17));
}

// rb:test items.update
/// items.update: two fields patched onto the row.
#[tokio::test]
async fn two_fields_are_patched_onto_the_row() {
    let response = with_json(TestClient::patch(url("/items/17")), "items.patch.json").await;

    let mut patched = row(17);
    for (name, value) in expected("items.patch.json").as_object().unwrap() {
        patched[name] = value.clone();
    }
    assert_eq!(json(response).await, patched);
}

#[tokio::test]
async fn a_patch_to_a_row_that_does_not_exist_is_404() {
    let response = with_json(TestClient::patch(url("/items/999999")), "items.patch.json").await;

    assert_eq!(status(&response), StatusCode::NOT_FOUND);
}

// rb:test items.delete
/// items.delete: 204 and no body for a row that exists, 404 for one that does not.
#[tokio::test]
async fn a_row_is_deleted_with_no_body() {
    let response = send(&service(), TestClient::delete(url("/items/17"))).await;
    assert_eq!(status(&response), StatusCode::NO_CONTENT);
    assert!(bytes(response).await.is_empty());

    let missing = send(&service(), TestClient::delete(url("/items/999999"))).await;
    assert_eq!(status(&missing), StatusCode::NOT_FOUND);
}
