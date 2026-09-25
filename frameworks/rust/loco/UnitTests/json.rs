use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::expected;

// rb:test json.small,json.medium,json.large
/// json.small, json.medium and json.large: each payload as the JSON committed for it.
#[tokio::test]
async fn each_payload_is_its_json() {
    request::<App, _, _>(|server, _| async move {
        for size in ["small", "medium", "large"] {
            let response = server.get(&format!("/json/{size}")).await;

            response.assert_status_ok();
            assert_eq!(response.header("content-type"), "application/json", "{size}");
            assert_eq!(response.json::<Value>(), expected(&format!("items.{size}.json")), "{size}");
        }
    })
    .await;
}
