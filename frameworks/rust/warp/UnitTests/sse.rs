use serde_json::Value;
use warp::http::StatusCode;

use crate::support::{app, expected, get_with, header};

// rb:test sse.medium
/// sse.medium: items.medium's rows, each the data of one event, with no length. warp writes no space
/// after the field's colon.
#[tokio::test]
async fn each_row_is_one_event() {
    let response = get_with(&app(), "/sse/medium", &[("accept", "text/event-stream")]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("text/event-stream"));
    assert_eq!(header(&response, "content-length"), None);
    let text = std::str::from_utf8(response.body()).unwrap();
    let events: Vec<Value> = text
        .split("\n\n")
        .filter(|event| !event.is_empty())
        .map(|event| serde_json::from_str(event.strip_prefix("data:").expect("each event is one data line")).unwrap())
        .collect();
    assert_eq!(Value::Array(events), expected("items.medium.json")["items"]);
}
