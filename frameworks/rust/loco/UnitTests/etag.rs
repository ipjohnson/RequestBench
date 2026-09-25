use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::{expected, settings};

// rb:test etag.small,etag.large
/// etag.small and etag.large: the answer carries the tag of its bytes.
#[tokio::test]
async fn the_answer_carries_its_tag() {
    request::<App, _, _>(|server, _| async move {
        for size in ["small", "large"] {
            let response = server.get(&format!("/etag/{size}")).await;

            response.assert_status_ok();
            assert!(response.header("etag").to_str().unwrap().starts_with('"'), "{size}");
            assert_eq!(response.json::<Value>(), expected(&format!("items.{size}.json")), "{size}");
        }
    })
    .await;
}

// rb:test etag.match_large
/// etag.match_large: Loco's etag middleware answers a matching If-None-Match with 304 and no body.
#[tokio::test]
async fn a_matching_tag_is_304() {
    request::<App, _, _>(|server, _| async move {
        let tag = server.get("/etag/large").await.header("etag");

        let response = server.get("/etag/large").add_header("if-none-match", tag.clone()).await;

        response.assert_status(StatusCode::NOT_MODIFIED);
        assert_eq!(response.header("etag"), tag);
        assert!(response.as_bytes().is_empty());
    })
    .await;
}

// rb:test etag.stale_large
/// etag.stale_large: a tag that does not match is answered in full.
#[tokio::test]
async fn a_stale_tag_is_answered_in_full() {
    request::<App, _, _>(|server, _| async move {
        let stale = settings()["staleEtag"].as_str().unwrap().to_owned();

        let response = server.get("/etag/large").add_header("if-none-match", stale).await;

        response.assert_status_ok();
        assert_eq!(response.json::<Value>(), expected("items.large.json"));
    })
    .await;
}
