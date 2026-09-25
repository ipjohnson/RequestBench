use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::{expected, gunzip, serial};

// rb:test compressed.gzip_large,compressed.gzip_small
/// compressed.gzip_large and compressed.gzip_small: Loco's compression middleware gzips both, since
/// tower-http's threshold is 32 bytes.
#[tokio::test]
async fn gzip_is_answered_with_gzip() {
    request::<App, _, _>(|server, _| async move {
        for size in ["large", "small"] {
            let response = server.get(&format!("/compressed/{size}")).add_header("accept-encoding", "gzip").await;

            assert_eq!(response.header("content-encoding"), "gzip", "{size}");
            let body: Value = serde_json::from_slice(&gunzip(response.as_bytes())).unwrap();
            assert_eq!(body, expected(&format!("items.{size}.json")), "{size}");
        }
    })
    .await;
}

// rb:test compressed.identity_small,compressed.identity_large
/// compressed.identity_small and compressed.identity_large: identity is answered as it is, and the
/// handler runs every time.
#[tokio::test]
async fn identity_is_answered_as_it_is() {
    request::<App, _, _>(|server, _| async move {
        for size in ["small", "large"] {
            let path = format!("/compressed/{size}");
            let first = server.get(&path).add_header("accept-encoding", "identity").await;
            let second = server.get(&path).add_header("accept-encoding", "identity").await;

            assert_eq!(second.maybe_header("content-encoding"), None, "{size}");
            assert_eq!(second.json::<Value>(), expected(&format!("items.{size}.json")), "{size}");
            assert!(serial(&second) > serial(&first), "{size}");
        }
    })
    .await;
}

#[tokio::test]
async fn compression_covers_every_route() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/json/large").add_header("accept-encoding", "gzip").await;

        assert_eq!(response.header("content-encoding"), "gzip");
    })
    .await;
}
