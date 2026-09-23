use serde_json::Value;
use warp::http::StatusCode;

use crate::support::{app, expected, get, header};

// rb:test stream.ndjson
/// stream.ndjson: items.medium's rows, one per line, with no length.
#[tokio::test]
async fn each_row_is_one_line() {
    let response = get(&app(), "/stream/items").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("application/x-ndjson"));
    assert_eq!(header(&response, "content-length"), None);
    let text = std::str::from_utf8(response.body()).unwrap();
    let rows: Vec<Value> = text.lines().map(|line| serde_json::from_str(line).unwrap()).collect();
    assert_eq!(Value::Array(rows), expected("items.medium.json")["items"]);
}
