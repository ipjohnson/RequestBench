use warp::http::StatusCode;

use crate::support::{app, expected, get, header, json};

// rb:test json.small,json.medium,json.large
/// json.small, json.medium and json.large: each payload as its committed file holds it.
#[tokio::test]
async fn each_payload_is_answered_as_its_file_holds_it() {
    for size in ["small", "medium", "large"] {
        let response = get(&app(), &format!("/json/{size}")).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, "content-type"), Some("application/json"));
        assert_eq!(json(&response), expected(&format!("items.{size}.json")));
    }
}
