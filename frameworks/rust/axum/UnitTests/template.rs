use axum::http::StatusCode;

use crate::support::{app, bytes, get, header, normal, page};

// rb:test template.small,template.medium
/// template.small and template.medium: the page each payload renders, compared as the corpus
/// compares it.
#[tokio::test]
async fn each_payload_renders_its_page() {
    for size in ["small", "medium"] {
        let response = get(&app(), &format!("/template/{size}")).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert!(header(&response, "content-type").unwrap().starts_with("text/html"));
        let html = String::from_utf8(bytes(response).await.to_vec()).unwrap();
        assert_eq!(normal(&html), page(&format!("items.{size}.json")));
    }
}
