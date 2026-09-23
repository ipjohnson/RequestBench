use rocket::http::Status;

use crate::support::{bytes, client, expected, get, header, json, serial};

// rb:test etag.small,etag.large
/// etag.small and etag.large: the answer carries the hash of its body, and the handler runs for
/// every request.
#[test]
fn the_answer_carries_its_hash() {
    for size in ["small", "large"] {
        let client = client();
        let path = format!("/etag/{size}");

        let first = get(&client, &path, &[]);
        let second = get(&client, &path, &[]);

        assert!(serial(&second) > serial(&first));
        assert_eq!(header(&first, "etag"), header(&second, "etag"));
        assert!(header(&second, "etag").unwrap().starts_with("W/\""));
        assert_eq!(header(&second, "content-type").as_deref(), Some("application/json"));
        assert_eq!(json(second), expected(&format!("items.{size}.json")));
    }
}

// rb:test etag.match_large
/// etag.match_large: the tag sent back is answered 304 with no body.
#[test]
fn a_matching_tag_is_not_modified() {
    let client = client();
    let tag = header(&get(&client, "/etag/large", &[]), "etag").unwrap();

    let response = get(&client, "/etag/large", &[("if-none-match", &tag)]);

    assert_eq!(response.status(), Status::NotModified);
    assert_eq!(header(&response, "etag"), Some(tag));
    assert!(bytes(response).is_empty());
}

// rb:test etag.stale_large
/// etag.stale_large: a tag that does not match is answered in full.
#[test]
fn a_stale_tag_is_answered_in_full() {
    let client = client();
    let stale = expected("settings.json")["staleEtag"].as_str().unwrap().to_owned();

    let response = get(&client, "/etag/large", &[("if-none-match", &stale)]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(json(response), expected("items.large.json"));
}
