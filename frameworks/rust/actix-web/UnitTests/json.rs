use actix_web::http::StatusCode;

use crate::support::{app, expected, header, json};

// rb:test json.small,json.medium,json.large
/// json.small, json.medium and json.large: each payload as its committed file holds it.
#[actix_web::test]
async fn each_payload_is_answered_as_its_file_holds_it() {
    let app = app().await;
    for size in ["small", "medium", "large"] {
        let response = app.get(&format!("/json/{size}")).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, "content-type"), Some("application/json"));
        assert_eq!(json(response).await, expected(&format!("items.{size}.json")));
    }
}
