use rocket::http::Status;

use crate::support::{client, expected, get, header, json};

// rb:test json.small,json.medium,json.large
/// json.small, json.medium and json.large: each payload as its committed file holds it.
#[test]
fn each_payload_is_answered_as_its_file_holds_it() {
    let client = client();
    for size in ["small", "medium", "large"] {
        let response = get(&client, &format!("/json/{size}"), &[]);

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(header(&response, "content-type").as_deref(), Some("application/json"));
        assert_eq!(json(response), expected(&format!("items.{size}.json")));
    }
}
