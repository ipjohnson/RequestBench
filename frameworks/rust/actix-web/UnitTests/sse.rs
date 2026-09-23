use actix_web::http::StatusCode;
use serde_json::Value;

use crate::support::{app, bytes, expected, header};

// rb:test sse.medium
/// sse.medium: items.medium's rows, each the data of one event, with no length.
#[actix_web::test]
async fn each_row_is_one_event() {
    let response = app().await.get_with("/sse/medium", &[("accept", "text/event-stream")]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("text/event-stream"));
    assert_eq!(header(&response, "content-length"), None);
    let text = String::from_utf8(bytes(response).await.to_vec()).unwrap();
    let events: Vec<Value> = text
        .split("\n\n")
        .filter(|event| !event.is_empty())
        .map(|event| serde_json::from_str(event.strip_prefix("data: ").expect("each event is one data line")).unwrap())
        .collect();
    assert_eq!(Value::Array(events), expected("items.medium.json")["items"]);
}
