use actix_web::http::StatusCode;

use crate::support::{app, bytes, header, normal, page};

// rb:test template.small,template.medium
/// template.small and template.medium: the page each payload renders, compared as the corpus
/// compares it.
#[actix_web::test]
async fn each_payload_renders_its_page() {
    let app = app().await;
    for size in ["small", "medium"] {
        let response = app.get(&format!("/template/{size}")).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert!(header(&response, "content-type").unwrap().starts_with("text/html"));
        let html = String::from_utf8(bytes(response).await.to_vec()).unwrap();
        assert_eq!(normal(&html), page(&format!("items.{size}.json")));
    }
}
