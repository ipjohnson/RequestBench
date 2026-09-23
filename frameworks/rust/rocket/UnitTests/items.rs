use rocket::http::{ContentType, Status};
use rocket::local::blocking::{Client, LocalResponse};
use serde_json::{Value, json as literal};

use crate::support::{bytes, client, expected, file, get, header, json, post};

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

fn put<'c>(client: &'c Client, path: &str, body: Vec<u8>) -> LocalResponse<'c> {
    client.put(path.to_owned()).header(ContentType::JSON).body(body).dispatch()
}

fn patch<'c>(client: &'c Client, path: &str, body: Vec<u8>) -> LocalResponse<'c> {
    client.patch(path.to_owned()).header(ContentType::JSON).body(body).dispatch()
}

// rb:test items.read
/// items.read: the row with the id in the path.
#[test]
fn a_row_is_read_by_its_id() {
    let client = client();

    let response = get(&client, "/items/17", &[]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(json(response), row(17));
}

// rb:test items.head
/// items.head: Rocket answers HEAD with the GET route, with its type and no body.
#[test]
fn head_is_the_get_route_with_no_body() {
    let client = client();

    let response = client.head("/items/17").dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.content_type(), Some(ContentType::JSON));
    assert!(bytes(response).is_empty());
}

// rb:test items.create
/// items.create: 201, where the item would live, and the item under the id after the last row.
#[test]
fn a_new_item_is_created_after_the_last_row() {
    let client = client();

    let response = post(&client, "/items", "application/json", file("items.new.json"));

    assert_eq!(response.status(), Status::Created);
    assert_eq!(header(&response, "location").as_deref(), Some("/items/1426"));
    assert_eq!(json(response), replaced(1426));
}

// rb:test items.replace
/// items.replace: the whole item put at the id in the path.
#[test]
fn an_item_is_replaced_at_its_id() {
    let client = client();

    let response = put(&client, "/items/17", file("items.new.json"));

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(json(response), replaced(17));
}

// rb:test items.update
/// items.update: two fields patched onto the row.
#[test]
fn two_fields_are_patched_onto_the_row() {
    let client = client();

    let response = patch(&client, "/items/17", file("items.patch.json"));

    let mut patched = row(17);
    for (name, value) in expected("items.patch.json").as_object().unwrap() {
        patched[name] = value.clone();
    }
    assert_eq!(json(response), patched);
}

#[test]
fn a_patch_to_a_row_that_does_not_exist_is_404() {
    let client = client();

    let response = patch(&client, "/items/999999", file("items.patch.json"));

    assert_eq!(response.status(), Status::NotFound);
}

// rb:test items.delete
/// items.delete: 204 and no body for a row that exists, 404 for one that does not.
#[test]
fn a_row_is_deleted_with_no_body() {
    let client = client();

    let response = client.delete("/items/17").dispatch();
    assert_eq!(response.status(), Status::NoContent);
    assert!(bytes(response).is_empty());

    let missing = client.delete("/items/999999").dispatch();
    assert_eq!(missing.status(), Status::NotFound);
}
