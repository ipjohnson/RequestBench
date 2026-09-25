use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::expected;

// rb:test stream.ndjson
/// stream.ndjson: each row of items.medium is a line, with no length.
#[tokio::test]
async fn each_row_is_a_line() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/stream/items").await;

        response.assert_status_ok();
        assert_eq!(response.header("content-type"), "application/x-ndjson");
        assert_eq!(response.maybe_header("content-length"), None);
        let rows: Vec<Value> = response.text().lines().map(|line| serde_json::from_str(line).unwrap()).collect();
        assert_eq!(Value::from(rows), expected("items.medium.json")["items"]);
    })
    .await;
}
