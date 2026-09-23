use salvo::http::StatusCode;
use serde_json::json as literal;

use crate::support::{file, json, post, service, status, with_echo};

// rb:test forms.urlencoded
/// forms.urlencoded: query.many's eight fields posted as a form, bound and echoed.
#[tokio::test]
async fn a_form_is_bound_and_echoed() {
    let form = "page=417&size=38&status=paid&category=garden&sort=created&q=alpha+bravo&minPrice=1200&maxPrice=34000";

    let response = post(&service(), "/forms/urlencoded", "application/x-www-form-urlencoded", form).await;

    assert_eq!(status(&response), StatusCode::OK);
    let echo = literal!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
    assert_eq!(json(response).await, with_echo("items.small.json", echo));
}

fn multipart(parts: &[(&str, &[u8])], text: &[u8]) -> Vec<u8> {
    let mut body = Vec::new();
    for (disposition, content) in parts {
        body.extend_from_slice(format!("--rb\r\nContent-Disposition: form-data; {disposition}\r\n\r\n").as_bytes());
        body.extend_from_slice(content);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(b"--rb\r\nContent-Disposition: form-data; name=\"file\"; filename=\"forms.file.txt\"\r\nContent-Type: text/plain\r\n\r\n");
    body.extend_from_slice(text);
    body.extend_from_slice(b"\r\n--rb--\r\n");
    body
}

// rb:test forms.multipart
/// forms.multipart: two fields and a file, the fields echoed and the file named and counted.
#[tokio::test]
async fn an_upload_is_read_to_the_end() {
    let text = file("forms.file.txt");
    let body = multipart(&[("name=\"tenant\"", b"qwertyuiopas"), ("name=\"requestId\"", b"0123456789abcdef")], &text);

    let response = post(&service(), "/forms/multipart", "multipart/form-data; boundary=rb", body).await;

    assert_eq!(status(&response), StatusCode::OK);
    let answer = literal!({
        "file": { "name": "forms.file.txt", "bytes": text.len() },
        "echo": { "tenant": "qwertyuiopas", "requestId": "0123456789abcdef" },
    });
    assert_eq!(json(response).await, answer);
}

#[tokio::test]
async fn an_upload_missing_a_field_is_400() {
    let body = multipart(&[("name=\"tenant\"", b"qwertyuiopas")], b"text");

    let response = post(&service(), "/forms/multipart", "multipart/form-data; boundary=rb", body).await;

    assert_eq!(status(&response), StatusCode::BAD_REQUEST);
}
