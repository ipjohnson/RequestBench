use rocket::http::{ContentType, Status};

use crate::support::{client, get, normal, page, text};

// rb:test template.small,template.medium,template.large
/// template.small, template.medium and template.large: the page each payload renders, compared as
/// the corpus compares it.
#[test]
fn each_payload_renders_its_page() {
    let client = client();
    for size in ["small", "medium", "large"] {
        let response = get(&client, &format!("/template/{size}"), &[]);

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(response.content_type(), Some(ContentType::HTML));
        assert_eq!(normal(&text(response)), page(&format!("items.{size}.json")));
    }
}
