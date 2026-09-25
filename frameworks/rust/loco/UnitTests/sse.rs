use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::expected;

// rb:test sse.medium
/// sse.medium: each row of items.medium is the data of one event, with no id.
#[tokio::test]
async fn each_row_is_an_event() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/sse/medium").add_header("accept", "text/event-stream").await;

        response.assert_status_ok();
        assert_eq!(response.header("content-type"), "text/event-stream");
        let text = response.text();
        let data: Vec<Value> = text.lines().filter_map(|line| line.strip_prefix("data: ")).map(|row| serde_json::from_str(row).unwrap()).collect();
        assert_eq!(Value::from(data), expected("items.medium.json")["items"]);
        assert!(!text.lines().any(|line| line.starts_with("id:")));
    })
    .await;
}
