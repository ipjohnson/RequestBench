use rocket::http::{ContentType, Status};

use crate::support::{client, get, text};

// rb:test baseline.plaintext
/// baseline.plaintext: the fixed string, as text.
#[test]
fn the_string_is_text() {
    let client = client();

    let response = get(&client, "/plaintext", &[]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.content_type(), Some(ContentType::Plain));
    assert_eq!(text(response), "Hello, World!");
}
