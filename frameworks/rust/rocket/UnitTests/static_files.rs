use rocket::http::{ContentType, Status};

use crate::support::{bytes, client, file, get, header};

// rb:test static.file
/// static.file: items.large.json byte for byte, with its type and its modification time. Rocket
/// finds the file's length when it writes the answer, which the local client never does.
#[test]
fn the_file_is_sent_as_it_is() {
    let client = client();

    let response = get(&client, "/static/items.large.json", &[]);

    let committed = file("items.large.json");
    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.content_type(), Some(ContentType::JSON));
    assert!(header(&response, "last-modified").is_some());
    assert_eq!(bytes(response), committed);
}

#[test]
fn a_file_that_is_not_there_is_404() {
    let client = client();

    let response = get(&client, "/static/missing.json", &[]);

    assert_eq!(response.status(), Status::NotFound);
}
