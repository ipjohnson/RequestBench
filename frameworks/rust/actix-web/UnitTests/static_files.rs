use actix_web::http::StatusCode;

use crate::support::{app, bytes, file, header};

// rb:test static.file
/// static.file: items.large.json byte for byte, with its type, its length and its modification time.
#[actix_web::test]
async fn the_file_is_sent_as_it_is() {
    let response = app().await.get("/static/items.large.json").await;

    let committed = file("items.large.json");
    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
    assert!(header(&response, "last-modified").is_some());
    assert_eq!(bytes(response).await, committed);
}
