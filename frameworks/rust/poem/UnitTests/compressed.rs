use std::io::Read;

use flate2::read::GzDecoder;
use poem::Response;
use poem::http::StatusCode;
use serde_json::Value;

use crate::support::{app, bytes, expected, get_with, header, serial};

async fn decoded(response: Response) -> Value {
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
/// compressed.gzip_large and compressed.gzip_small: asked for gzip, each payload arrives gzipped,
/// because the middleware has no size threshold, and each decodes to its payload.
#[tokio::test]
async fn gzip_is_written_when_asked_for() {
    for size in ["small", "large"] {
        let response = get_with(&app(), &format!("/compressed/{size}"), &[("accept-encoding", "gzip")]).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, "content-encoding"), Some("gzip"), "{size}");
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

#[tokio::test]
async fn a_route_outside_the_family_is_never_compressed() {
    let response = get_with(&app(), "/json/large", &[("accept-encoding", "gzip")]).await;

    assert_eq!(header(&response, "content-encoding"), None);
}
