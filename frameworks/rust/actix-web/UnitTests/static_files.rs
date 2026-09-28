use actix_web::http::StatusCode;

use crate::support::{app, bytes, file, header};

// rb:test static.small,static.medium,static.large
/// static.small, static.medium and static.large: each file byte for byte, with its type, its length
/// and its modification time.
#[actix_web::test]
async fn each_file_is_sent_as_it_is() {
    for name in ["items.small.json", "items.medium.json", "items.large.json"] {
        let response = app().await.get(&format!("/static/{name}")).await;

        let committed = file(name);
        assert_eq!(response.status(), StatusCode::OK);
        assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
        assert!(header(&response, "last-modified").is_some());
        assert_eq!(bytes(response).await, committed);
    }
}
