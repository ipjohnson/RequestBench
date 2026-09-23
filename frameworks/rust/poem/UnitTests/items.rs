use poem::Response;
use poem::http::{Method, StatusCode};
use serde_json::{Value, json as literal};

use crate::support::{app, bytes, expected, file, get, header, json, post, send};

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

async fn with_body(method: Method, path: &str, body: Vec<u8>) -> Response {
    send(&app(), method, path, &[], Some(("application/json", body))).await
}

// rb:test items.read
/// items.read: the row with the id in the path.
#[tokio::test]
async fn a_row_is_read_by_its_id() {
    let response = get(&app(), "/items/17").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await, row(17));
}

// rb:test items.head
/// items.head: HEAD is answered by the GET endpoint, with its type and no body.
#[tokio::test]
async fn head_is_the_get_endpoint_with_no_body() {
    let response = send(&app(), Method::HEAD, "/items/17", &[], None).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
    assert!(bytes(response).await.is_empty());
}

// rb:test items.create
/// items.create: 201, where the item would live, and the item under the id after the last row.
#[tokio::test]
async fn a_new_item_is_created_after_the_last_row() {
    let response = post(&app(), "/items", "application/json", file("items.new.json")).await;

    assert_eq!(response.status(), StatusCode::CREATED);
    assert_eq!(header(&response, "location"), Some("/items/1426"));
    assert_eq!(json(response).await, replaced(1426));
}

// rb:test items.replace
/// items.replace: the whole item put at the id in the path.
#[tokio::test]
async fn an_item_is_replaced_at_its_id() {
    let response = with_body(Method::PUT, "/items/17", file("items.new.json")).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await, replaced(17));
}

// rb:test items.update
/// items.update: two fields patched onto the row.
#[tokio::test]
async fn two_fields_are_patched_onto_the_row() {
    let response = with_body(Method::PATCH, "/items/17", file("items.patch.json")).await;

    let mut patched = row(17);
    for (name, value) in expected("items.patch.json").as_object().unwrap() {
        patched[name] = value.clone();
    }
    assert_eq!(json(response).await, patched);
}

#[tokio::test]
async fn a_patch_to_a_row_that_does_not_exist_is_404() {
    let response = with_body(Method::PATCH, "/items/999999", file("items.patch.json")).await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// rb:test items.delete
/// items.delete: 204 and no body for a row that exists, 404 for one that does not.
#[tokio::test]
async fn a_row_is_deleted_with_no_body() {
    let response = send(&app(), Method::DELETE, "/items/17", &[], None).await;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(bytes(response).await.is_empty());

    let missing = send(&app(), Method::DELETE, "/items/999999", &[], None).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}
