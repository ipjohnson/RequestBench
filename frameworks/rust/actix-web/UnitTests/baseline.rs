use actix_web::http::StatusCode;

use crate::support::{app, bytes, header};

// rb:test baseline.plaintext
/// baseline.plaintext: the fixed string, as text.
#[actix_web::test]
async fn the_string_is_text() {
    let response = app().await.get("/plaintext").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert_eq!(bytes(response).await, "Hello, World!");
}
