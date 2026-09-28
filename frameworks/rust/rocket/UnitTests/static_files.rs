use rocket::http::{ContentType, Status};

use crate::support::{bytes, client, file, get, header};

// rb:test static.small,static.medium,static.large
/// static.small, static.medium and static.large: each file byte for byte, with its type and its
/// modification time. Rocket finds the file's length when it writes the answer, which the local
/// client never does.
#[test]
fn each_file_is_sent_as_it_is() {
    let client = client();

    for name in ["items.small.json", "items.medium.json", "items.large.json"] {
        let response = get(&client, &format!("/static/{name}"), &[]);

        let committed = file(name);
        assert_eq!(response.status(), Status::Ok);
        assert_eq!(response.content_type(), Some(ContentType::JSON));
        assert!(header(&response, "last-modified").is_some());
        assert_eq!(bytes(response), committed);
    }
}

#[test]
fn a_file_that_is_not_there_is_404() {
    let client = client();

    let response = get(&client, "/static/missing.json", &[]);

    assert_eq!(response.status(), Status::NotFound);
}
