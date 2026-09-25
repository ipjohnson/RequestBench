use implementation::app::App;
use loco_rs::testing::request::request;

use crate::support::{normal, page};

// rb:test template.small,template.medium
/// template.small and template.medium: the payload rendered by Loco's Tera view engine.
#[tokio::test]
async fn the_payload_is_rendered() {
    request::<App, _, _>(|server, _| async move {
        for size in ["small", "medium"] {
            let response = server.get(&format!("/template/{size}")).await;

            response.assert_status_ok();
            assert_eq!(response.header("content-type"), "text/html; charset=utf-8", "{size}");
            assert_eq!(normal(&response.text()), page(&format!("items.{size}.json")), "{size}");
        }
    })
    .await;
}
