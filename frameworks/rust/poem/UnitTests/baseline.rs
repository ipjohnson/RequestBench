use poem::http::StatusCode;

use crate::support::{app, bytes, get, header};

// rb:test baseline.plaintext
/// baseline.plaintext: the fixed string, as text.
#[tokio::test]
async fn the_string_is_text() {
    let response = get(&app(), "/plaintext").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert_eq!(bytes(response).await, b"Hello, World!");
}
