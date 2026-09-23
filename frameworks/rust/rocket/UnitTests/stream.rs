use rocket::http::Status;
use serde_json::Value;

use crate::support::{client, expected, get, text};

// rb:test stream.ndjson
/// stream.ndjson: items.medium's rows, one per line, with no length.
#[test]
fn each_row_is_one_line() {
    let client = client();

    let response = get(&client, "/stream/items", &[]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.content_type().map(|t| t.to_string()).as_deref(), Some("application/x-ndjson"));
    assert_eq!(response.body().preset_size(), None);
    let rows: Vec<Value> = text(response).lines().map(|line| serde_json::from_str(line).unwrap()).collect();
    assert_eq!(Value::Array(rows), expected("items.medium.json")["items"]);
}
