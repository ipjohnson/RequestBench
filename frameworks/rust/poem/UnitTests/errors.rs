use poem::http::{Method, StatusCode};

use crate::support::{app, bytes, get, header, post, send};

// rb:test errors.unmatched
/// errors.unmatched: the router answers a path it has no route for with 404 and its message.
#[tokio::test]
async fn a_path_with_no_route_is_404() {
    let response = get(&app(), "/errors/unmatched").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert_eq!(bytes(response).await, b"not found");
}

// rb:test errors.not_found
/// errors.not_found: the route matches and the handler finds no row.
#[tokio::test]
async fn a_row_that_does_not_exist_is_404() {
    let response = get(&app(), "/items/999999").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// rb:test errors.wrong_method
/// errors.wrong_method: a method /items/:id has no endpoint for is 405, with no Allow header.
#[tokio::test]
async fn a_method_the_path_lacks_is_405() {
    let response = post(&app(), "/items/17", "application/json", "{}").await;

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(header(&response, "allow"), None);
    assert_eq!(bytes(response).await, b"method not allowed");
}

#[tokio::test]
async fn options_is_a_method_like_any_other() {
    let response = send(&app(), Method::OPTIONS, "/json/small", &[], None).await;

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON is refused by poem's Json extractor with 400, as text,
/// before any rule runs.
#[tokio::test]
async fn a_body_that_is_not_json_is_400_from_the_extractor() {
    let response = post(&app(), "/body/validate/small", "application/json", r#"{"customerId": 1, "lines": ["#).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert!(bytes(response).await.starts_with(b"parse error: "));
}
