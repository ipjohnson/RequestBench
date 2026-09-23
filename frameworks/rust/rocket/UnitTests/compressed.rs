use std::io::Read;

use flate2::read::GzDecoder;
use rocket::http::Status;
use rocket::local::blocking::LocalResponse;
use serde_json::Value;

use crate::support::{bytes, client, expected, get, header, serial};

fn decoded(response: LocalResponse<'_>) -> Value {
    let gzipped = header(&response, "content-encoding").as_deref() == Some("gzip");
    let body = bytes(response);
    if !gzipped {
        return serde_json::from_slice(&body).unwrap();
    }
    let mut text = String::new();
    GzDecoder::new(&body[..]).read_to_string(&mut text).unwrap();
    serde_json::from_str(&text).unwrap()
}

// rb:test compressed.gzip_large,compressed.gzip_small
/// compressed.gzip_large and compressed.gzip_small: asked for gzip, each payload arrives gzipped
/// and decodes to itself. The responder compresses whatever the size.
#[test]
fn gzip_is_written_when_asked_for() {
    let client = client();
    for size in ["small", "large"] {
        let response = get(&client, &format!("/compressed/{size}"), &[("accept-encoding", "gzip")]);

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(header(&response, "content-encoding").as_deref(), Some("gzip"));
        assert_eq!(decoded(response), expected(&format!("items.{size}.json")));
    }
}

// rb:test compressed.identity_large,compressed.identity_small
/// compressed.identity_large and compressed.identity_small: asked for identity, nothing is
/// compressed, and the handler runs for every request.
#[test]
fn identity_is_left_alone_and_the_handler_runs_each_time() {
    let client = client();
    for size in ["small", "large"] {
        let path = format!("/compressed/{size}");

        let first = get(&client, &path, &[("accept-encoding", "identity")]);
        let second = get(&client, &path, &[("accept-encoding", "identity")]);

        assert_eq!(header(&second, "content-encoding"), None);
        assert!(serial(&second) > serial(&first));
        assert_eq!(decoded(second), expected(&format!("items.{size}.json")));
    }
}
