use rocket::http::Status;
use serde_json::json as literal;

use crate::support::{client, file, json, post, with_echo};

// rb:test forms.urlencoded
/// forms.urlencoded: query.many's eight fields posted as a form, bound and echoed.
#[test]
fn a_form_is_bound_and_echoed() {
    let client = client();
    let form = "page=417&size=38&status=paid&category=garden&sort=created&q=alpha+bravo&minPrice=1200&maxPrice=34000";

    let response = post(&client, "/forms/urlencoded", "application/x-www-form-urlencoded", form);

    assert_eq!(response.status(), Status::Ok);
    let echo = literal!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
    assert_eq!(json(response), with_echo("items.small.json", echo));
}

// rb:test forms.multipart
/// forms.multipart: two fields and a file, the fields echoed and the file named and counted.
#[test]
fn an_upload_is_read_to_the_end() {
    let client = client();
    let text = file("forms.file.txt");
    let mut body = Vec::new();
    for (disposition, content) in [("name=\"tenant\"", &b"qwertyuiopas"[..]), ("name=\"requestId\"", b"0123456789abcdef")] {
        body.extend_from_slice(format!("--rb\r\nContent-Disposition: form-data; {disposition}\r\n\r\n").as_bytes());
        body.extend_from_slice(content);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(b"--rb\r\nContent-Disposition: form-data; name=\"file\"; filename=\"forms.file.txt\"\r\nContent-Type: text/plain\r\n\r\n");
    body.extend_from_slice(&text);
    body.extend_from_slice(b"\r\n--rb--\r\n");

    let response = post(&client, "/forms/multipart", "multipart/form-data; boundary=rb", body);

    assert_eq!(response.status(), Status::Ok);
    let answer = literal!({
        "file": { "name": "forms.file.txt", "bytes": text.len() },
        "echo": { "tenant": "qwertyuiopas", "requestId": "0123456789abcdef" },
    });
    assert_eq!(json(response), answer);
}
