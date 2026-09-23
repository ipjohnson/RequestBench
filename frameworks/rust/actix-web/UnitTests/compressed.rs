use std::io::Read;

use actix_web::body::MessageBody;
use actix_web::dev::ServiceResponse;
use actix_web::http::StatusCode;
use flate2::read::GzDecoder;
use serde_json::Value;

use crate::support::{app, bytes, expected, header, serial};

async fn decoded(response: ServiceResponse<impl MessageBody>) -> Value {
    let gzipped = header(&response, "content-encoding") == Some("gzip");
    let body = bytes(response).await;
    if !gzipped {
        return serde_json::from_slice(&body).unwrap();
    }
    let mut text = String::new();
    GzDecoder::new(&body[..]).read_to_string(&mut text).unwrap();
    serde_json::from_str(&text).unwrap()
}

// rb:test compressed.gzip_large,compressed.gzip_small
/// compressed.gzip_large and compressed.gzip_small: asked for gzip, both payloads arrive gzipped,
/// because Compress compresses a body of any size, and each decodes to its payload.
#[actix_web::test]
async fn gzip_is_written_when_asked_for() {
    let app = app().await;
    for size in ["small", "large"] {
        let response = app.get_with(&format!("/compressed/{size}"), &[("accept-encoding", "gzip")]).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, "content-encoding"), Some("gzip"));
        assert_eq!(header(&response, "vary"), Some("accept-encoding"));
        assert_eq!(decoded(response).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test compressed.identity_large,compressed.identity_small
/// compressed.identity_large and compressed.identity_small: asked for identity, nothing is
/// compressed, and the handler runs for every request. Compress writes Vary only on an answer it
/// compressed.
#[actix_web::test]
async fn identity_is_left_alone_and_the_handler_runs_each_time() {
    let app = app().await;
    for size in ["small", "large"] {
        let path = format!("/compressed/{size}");

        let first = app.get_with(&path, &[("accept-encoding", "identity")]).await;
        let second = app.get_with(&path, &[("accept-encoding", "identity")]).await;

        assert_eq!(header(&second, "content-encoding"), None);
        assert_eq!(header(&second, "vary"), None);
        assert!(serial(&second) > serial(&first));
        assert_eq!(decoded(second).await, expected(&format!("items.{size}.json")));
    }
}
