use axum::http::StatusCode;

use crate::support::{app, bytes, expected, get, get_with, header, json, serial};

// rb:test etag.small,etag.large
/// etag.small and etag.large: the answer carries the hash of its body, and the handler runs for
/// every request.
#[tokio::test]
async fn the_answer_carries_its_hash() {
    for size in ["small", "large"] {
        let app = app();
        let path = format!("/etag/{size}");

        let first = get(&app, &path).await;
        let second = get(&app, &path).await;

        assert!(serial(&second) > serial(&first));
        assert_eq!(header(&first, "etag"), header(&second, "etag"));
        assert!(header(&second, "etag").unwrap().starts_with('"'));
        assert_eq!(json(second).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test etag.match_large
/// etag.match_large: the tag sent back is answered 304 with no body.
#[tokio::test]
async fn a_matching_tag_is_not_modified() {
    let app = app();
    let tag = header(&get(&app, "/etag/large").await, "etag").unwrap().to_owned();

    let response = get_with(&app, "/etag/large", &[("if-none-match", &tag)]).await;

    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(header(&response, "etag"), Some(tag.as_str()));
    assert!(bytes(response).await.is_empty());
}

// rb:test etag.stale_large
/// etag.stale_large: a tag that does not match is answered in full.
#[tokio::test]
async fn a_stale_tag_is_answered_in_full() {
    let stale = expected("settings.json")["staleEtag"].as_str().unwrap().to_owned();

    let response = get_with(&app(), "/etag/large", &[("if-none-match", &stale)]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await, expected("items.large.json"));
}
