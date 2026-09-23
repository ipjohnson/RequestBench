use salvo::http::StatusCode;

use crate::support::{bytes, get, header, service, status};

// rb:test baseline.plaintext
/// baseline.plaintext: the fixed string, as text.
#[tokio::test]
async fn the_string_is_text() {
    let response = get(&service(), "/plaintext").await;

    assert_eq!(status(&response), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert_eq!(bytes(response).await, b"Hello, World!");
}
