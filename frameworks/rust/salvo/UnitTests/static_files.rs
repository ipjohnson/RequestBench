use salvo::http::StatusCode;

use crate::support::{bytes, file, get, header, service, status};

// rb:test static.file
/// static.file: items.large.json byte for byte, with its type, its length and its modification time.
#[tokio::test]
async fn the_file_is_sent_as_it_is() {
    let response = get(&service(), "/static/items.large.json").await;

    let committed = file("items.large.json");
    assert_eq!(status(&response), StatusCode::OK);
    assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
    assert_eq!(header(&response, "content-length"), Some(committed.len().to_string().as_str()));
    assert!(header(&response, "last-modified").is_some());
    assert_eq!(bytes(response).await, committed);
}
