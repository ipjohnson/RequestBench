use actix_web::http::StatusCode;

use crate::support::{app, bytes, expected, header, json, serial};

// rb:test etag.small,etag.large
/// etag.small and etag.large: the answer carries the hash of its body, and the handler runs for
/// every request.
#[actix_web::test]
async fn the_answer_carries_its_hash() {
    let app = app().await;
    for size in ["small", "large"] {
        let path = format!("/etag/{size}");

        let first = app.get(&path).await;
        let second = app.get(&path).await;

        assert!(serial(&second) > serial(&first));
        assert_eq!(header(&first, "etag"), header(&second, "etag"));
        assert!(header(&second, "etag").unwrap().starts_with("W/\""));
        assert_eq!(json(second).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test etag.match_large
/// etag.match_large: the tag sent back is answered 304 with no body. The middleware writes the 304
/// in place of the handler's answer, so it carries no ETag.
#[actix_web::test]
async fn a_matching_tag_is_not_modified() {
    let app = app().await;
    let tag = header(&app.get("/etag/large").await, "etag").unwrap().to_owned();

    let response = app.get_with("/etag/large", &[("if-none-match", &tag)]).await;

    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(header(&response, "etag"), None);
    assert!(bytes(response).await.is_empty());
}

// rb:test etag.stale_large
/// etag.stale_large: a tag that does not match is answered in full.
#[actix_web::test]
async fn a_stale_tag_is_answered_in_full() {
    let stale = expected("settings.json")["staleEtag"].as_str().unwrap().to_owned();

    let response = app().await.get_with("/etag/large", &[("if-none-match", &stale)]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json(response).await, expected("items.large.json"));
}
