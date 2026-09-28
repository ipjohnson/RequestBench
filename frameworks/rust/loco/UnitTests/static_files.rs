use axum::http::StatusCode;
use implementation::app::App;
use loco_rs::testing::request::request;

use crate::support::file;

// rb:test static.small,static.medium,static.large
/// static.small, static.medium and static.large: each committed file, byte for byte, with its
/// modification time.
#[tokio::test]
async fn each_file_is_served() {
    request::<App, _, _>(|server, _| async move {
        for name in ["items.small.json", "items.medium.json", "items.large.json"] {
            let response = server.get(&format!("/static/{name}")).await;

            response.assert_status_ok();
            assert_eq!(response.header("content-type"), "application/json");
            assert!(response.maybe_header("last-modified").is_some());
            assert_eq!(response.as_bytes().as_ref(), file(name).as_slice());
        }
    })
    .await;
}

#[tokio::test]
async fn a_file_the_directory_does_not_hold_is_404() {
    request::<App, _, _>(|server, _| async move {
        server.get("/static/missing.json").await.assert_status(StatusCode::NOT_FOUND);
    })
    .await;
}
