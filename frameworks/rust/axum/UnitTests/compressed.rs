use std::io::Read;

use axum::http::StatusCode;
use flate2::read::GzDecoder;
use serde_json::Value;

use crate::support::{app, bytes, expected, get_with, header, serial};

async fn decoded(response: axum::http::Response<axum::body::Body>) -> Value {
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
/// compressed.gzip_large and compressed.gzip_small: asked for gzip, the large payload arrives
/// gzipped, and each decodes to its payload.
#[tokio::test]
async fn gzip_is_written_when_asked_for() {
    for size in ["small", "large"] {
        let response = get_with(&app(), &format!("/compressed/{size}"), &[("accept-encoding", "gzip")]).await;

        assert_eq!(response.status(), StatusCode::OK);
        if size == "large" {
            assert_eq!(header(&response, "content-encoding"), Some("gzip"));
        }
        assert_eq!(decoded(response).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test compressed.identity_large,compressed.identity_small
/// compressed.identity_large and compressed.identity_small: asked for identity, nothing is
/// compressed, and the handler runs for every request.
#[tokio::test]
async fn identity_is_left_alone_and_the_handler_runs_each_time() {
    for size in ["small", "large"] {
        let app = app();
        let path = format!("/compressed/{size}");

        let first = get_with(&app, &path, &[("accept-encoding", "identity")]).await;
        let second = get_with(&app, &path, &[("accept-encoding", "identity")]).await;

        assert_eq!(header(&second, "content-encoding"), None);
        assert!(serial(&second) > serial(&first));
        assert_eq!(decoded(second).await, expected(&format!("items.{size}.json")));
    }
}
