use salvo::http::StatusCode;

use crate::support::{bytes, file, get, header, service, status};

// rb:test static.small,static.medium,static.large
/// static.small, static.medium and static.large: each file byte for byte, with its type, its length
/// and its modification time.
#[tokio::test]
async fn each_file_is_sent_as_it_is() {
    for name in ["items.small.json", "items.medium.json", "items.large.json"] {
        let response = get(&service(), &format!("/static/{name}")).await;

        let committed = file(name);
        assert_eq!(status(&response), StatusCode::OK);
        assert!(header(&response, "content-type").unwrap().starts_with("application/json"));
        assert_eq!(header(&response, "content-length"), Some(committed.len().to_string().as_str()));
        assert!(header(&response, "last-modified").is_some());
        assert_eq!(bytes(response).await, committed);
    }
}
