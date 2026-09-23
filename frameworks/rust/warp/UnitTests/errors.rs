use warp::http::StatusCode;

use crate::support::{app, get, header, post};

// rb:test errors.unmatched
/// errors.unmatched: warp answers a path no route matches with 404 and no body.
#[tokio::test]
async fn a_path_with_no_route_is_404_with_no_body() {
    let response = get(&app(), "/errors/unmatched").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.body().is_empty());
}

// rb:test errors.not_found
/// errors.not_found: the route matches and the handler finds no row.
#[tokio::test]
async fn a_row_that_does_not_exist_is_404() {
    let response = get(&app(), "/items/999999").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// rb:test errors.wrong_method
/// errors.wrong_method: a method /items/{id} has no route for is warp's 405, as text, with no Allow
/// header.
#[tokio::test]
async fn a_method_the_path_lacks_is_405() {
    let response = post(&app(), "/items/17", "application/json", "{}").await;

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(header(&response, "allow"), None);
    assert_eq!(response.body(), "HTTP method not allowed");
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON is refused by warp's json body filter with 400, as
/// text, before any rule runs.
#[tokio::test]
async fn a_body_that_is_not_json_is_400_from_the_body_filter() {
    let response = post(&app(), "/body/validate/small", "application/json", r#"{"customerId": 1, "lines": ["#).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(header(&response, "content-type").unwrap().starts_with("text/plain"));
    assert!(response.body().starts_with(b"Request body deserialize error: "));
}
