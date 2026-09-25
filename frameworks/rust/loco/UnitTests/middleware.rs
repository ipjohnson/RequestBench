use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::expected;

// rb:test middleware.none,middleware.four,middleware.sixteen
/// middleware.none, middleware.four and middleware.sixteen: the layers pass the request through,
/// and the handler answers items.small.
#[tokio::test]
async fn the_layers_pass_the_request_through() {
    request::<App, _, _>(|server, _| async move {
        for route in ["none", "four", "sixteen"] {
            let response = server.get(&format!("/middleware/{route}")).await;

            response.assert_status_ok();
            assert_eq!(response.json::<Value>(), expected("items.small.json"), "{route}");
        }
    })
    .await;
}
