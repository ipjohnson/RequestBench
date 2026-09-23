use salvo::http::StatusCode;

use crate::support::{bytes, get, header, post, service, status};

// rb:test errors.unmatched
/// errors.unmatched: the router answers a path it has no route for with 404 and Salvo's default
/// error page, which is HTML when the request names no type it accepts.
#[tokio::test]
async fn a_path_with_no_route_is_404_with_salvos_page() {
    let response = get(&service(), "/errors/unmatched").await;

    assert_eq!(status(&response), StatusCode::NOT_FOUND);
    assert!(header(&response, "content-type").unwrap().starts_with("text/html"));
    assert!(String::from_utf8(bytes(response).await).unwrap().contains("<title>404: Not Found</title>"));
}

// rb:test errors.not_found
/// errors.not_found: the route matches and the handler finds no row.
#[tokio::test]
async fn a_row_that_does_not_exist_is_404() {
    let response = get(&service(), "/items/999999").await;

    assert_eq!(status(&response), StatusCode::NOT_FOUND);
}

// rb:test errors.wrong_method
/// errors.wrong_method: a method /items/{id} has no route for is 405, and Salvo names none of the
/// methods the path has in an Allow header.
#[tokio::test]
async fn a_method_the_path_lacks_is_405() {
    let response = post(&service(), "/items/17", "application/json", "{}").await;

    assert_eq!(status(&response), StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(header(&response, "allow"), None);
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON is refused by parse_json with 400, as Salvo's default
/// error page, before any rule runs.
#[tokio::test]
async fn a_body_that_is_not_json_is_400_from_parse_json() {
    let response = post(&service(), "/body/validate/small", "application/json", "{\"customerId\": 1, \"lines\": [").await;

    assert_eq!(status(&response), StatusCode::BAD_REQUEST);
    assert!(header(&response, "content-type").unwrap().starts_with("text/html"));
    assert!(String::from_utf8(bytes(response).await).unwrap().contains("parse http data failed"));
}
