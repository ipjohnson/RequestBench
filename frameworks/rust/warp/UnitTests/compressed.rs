use std::io::Read;

use bytes::Bytes;
use flate2::read::GzDecoder;
use serde_json::Value;
use warp::http::{Response, StatusCode};

use crate::support::{app, expected, get_with, header, serial};

fn decoded(response: &Response<Bytes>) -> Value {
    if header(response, "content-encoding") != Some("gzip") {
        return serde_json::from_slice(response.body()).unwrap();
    }
    let mut text = String::new();
    GzDecoder::new(&response.body()[..]).read_to_string(&mut text).unwrap();
    serde_json::from_str(&text).unwrap()
}

// rb:test compressed.gzip_large,compressed.gzip_small
/// compressed.gzip_large and compressed.gzip_small: asked for gzip, each payload arrives gzipped,
/// because warp's gzip filter compresses whatever it wraps, however small.
#[tokio::test]
async fn gzip_is_written_when_asked_for() {
    for size in ["small", "large"] {
        let response = get_with(&app(), &format!("/compressed/{size}"), &[("accept-encoding", "gzip")]).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, "content-encoding"), Some("gzip"));
        assert_eq!(decoded(&response), expected(&format!("items.{size}.json")));
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
        assert_eq!(decoded(&second), expected(&format!("items.{size}.json")));
    }
}

#[tokio::test]
async fn gzip_refused_by_its_weight_is_not_written() {
    let response = get_with(&app(), "/compressed/large", &[("accept-encoding", "gzip;q=0, identity")]).await;

    assert_eq!(header(&response, "content-encoding"), None);
}
