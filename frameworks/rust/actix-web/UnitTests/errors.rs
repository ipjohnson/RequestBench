use actix_web::http::StatusCode;

use crate::support::{app, bytes, header};

// rb:test errors.unmatched
/// errors.unmatched: the application answers a path it has no route for with 404 and no body.
#[actix_web::test]
async fn a_path_with_no_route_is_404_with_no_body() {
    let response = app().await.get("/errors/unmatched").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(bytes(response).await.is_empty());
}

// rb:test errors.not_found
/// errors.not_found: the route matches and the handler finds no row.
#[actix_web::test]
async fn a_row_that_does_not_exist_is_404() {
    let response = app().await.get("/items/999999").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// rb:test errors.wrong_method
/// errors.wrong_method: a method the /items/{id} resource has no route for is 405, naming the ones
/// it has.
#[actix_web::test]
async fn a_method_the_resource_lacks_is_405() {
    let response = app().await.post("/items/17", "application/json", "{}").await;

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(header(&response, "allow"), Some("GET, HEAD, PUT, PATCH, DELETE"));
}

#[actix_web::test]
async fn a_method_a_route_registered_on_its_own_lacks_falls_through_to_404() {
    let response = app().await.post("/json/small", "application/json", "{}").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(header(&response, "allow"), None);
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON is refused by actix-web-validator's Json extractor
/// with 400, as text, before any rule runs.
#[actix_web::test]
async fn a_body_that_is_not_json_is_400_from_the_extractor() {
    let response = app().await.post("/body/validate/small", "application/json", r#"{"customerId": 1, "lines": ["#).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(header(&response, "content-type"), None);
    assert_eq!(bytes(response).await, "Payload error: Json deserialize error: EOF while parsing a list at line 1 column 28");
}
