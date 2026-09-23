use salvo::http::StatusCode;

use crate::support::{expected, get, header, json, service, status};

// rb:test json.small,json.medium,json.large
/// json.small, json.medium and json.large: each payload as its committed file holds it.
#[tokio::test]
async fn each_payload_is_answered_as_its_file_holds_it() {
    for size in ["small", "medium", "large"] {
        let response = get(&service(), &format!("/json/{size}")).await;

        assert_eq!(status(&response), StatusCode::OK);
        assert_eq!(header(&response, "content-type"), Some("application/json; charset=utf-8"));
        assert_eq!(json(response).await, expected(&format!("items.{size}.json")));
    }
}
