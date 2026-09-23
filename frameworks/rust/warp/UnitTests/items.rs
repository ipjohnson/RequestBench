use serde_json::{Value, json as literal};
use warp::http::StatusCode;

use crate::support::{app, expected, file, get, header, json, post, raw, send, served};

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

async fn with_body(method: &str, path: &str, body: Vec<u8>) -> warp::http::Response<bytes::Bytes> {
    send(&app(), warp::test::request().method(method).path(path).header("content-type", "application/json").body(body)).await
}

// rb:test items.read
/// items.read: the row with the id in the path.
#[tokio::test]
async fn a_row_is_read_by_its_id() {
    let response = get(&app(), "/items/17").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(&response), row(17));
}

// rb:test items.head
/// items.head: HEAD is answered by the GET route, with its type, and hyper writes no body. Asked on
/// the wire, because the filter answers with the body and the server leaves it unwritten.
#[tokio::test]
async fn head_is_the_get_route_with_no_body() {
    let answer = raw(served().await, "HEAD /items/17 HTTP/1.1\r\nhost: warp\r\nconnection: close\r\n\r\n").await;

    let (head, body) = answer.split_once("\r\n\r\n").expect("the answer has a header block");
    assert!(head.starts_with("HTTP/1.1 200 OK\r\n"));
    assert!(head.lines().any(|line| line.to_ascii_lowercase().starts_with("content-type: application/json")));
    assert_eq!(body, "");
}

// rb:test items.create
/// items.create: 201, where the item would live, and the item under the id after the last row.
#[tokio::test]
async fn a_new_item_is_created_after_the_last_row() {
    let response = post(&app(), "/items", "application/json", file("items.new.json")).await;

    assert_eq!(response.status(), StatusCode::CREATED);
    assert_eq!(header(&response, "location"), Some("/items/1426"));
    assert_eq!(json(&response), replaced(1426));
}

// rb:test items.replace
/// items.replace: the whole item put at the id in the path.
#[tokio::test]
async fn an_item_is_replaced_at_its_id() {
    let response = with_body("PUT", "/items/17", file("items.new.json")).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(&response), replaced(17));
}

// rb:test items.update
/// items.update: two fields patched onto the row.
#[tokio::test]
async fn two_fields_are_patched_onto_the_row() {
    let response = with_body("PATCH", "/items/17", file("items.patch.json")).await;

    let mut patched = row(17);
    for (name, value) in expected("items.patch.json").as_object().unwrap() {
        patched[name] = value.clone();
    }
    assert_eq!(json(&response), patched);
}

#[tokio::test]
async fn a_patch_to_a_row_that_does_not_exist_is_404() {
    let response = with_body("PATCH", "/items/999999", file("items.patch.json")).await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// rb:test items.delete
/// items.delete: 204 and no body for a row that exists, 404 for one that does not.
#[tokio::test]
async fn a_row_is_deleted_with_no_body() {
    let response = send(&app(), warp::test::request().method("DELETE").path("/items/17")).await;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(response.body().is_empty());

    let missing = send(&app(), warp::test::request().method("DELETE").path("/items/999999")).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}
