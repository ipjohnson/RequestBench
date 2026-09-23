use rocket::http::{ContentType, Status};

use crate::support::{client, get, post};

// rb:test errors.unmatched
/// errors.unmatched: no route matches the path, and Rocket's default catcher answers 404.
#[test]
fn a_path_with_no_route_is_404() {
    let client = client();

    let response = get(&client, "/errors/unmatched", &[]);

    assert_eq!(response.status(), Status::NotFound);
    assert_eq!(response.content_type(), Some(ContentType::HTML));
}

// rb:test errors.not_found
/// errors.not_found: the route matches and the handler finds no row.
#[test]
fn a_row_that_does_not_exist_is_404() {
    let client = client();

    let response = get(&client, "/items/999999", &[]);

    assert_eq!(response.status(), Status::NotFound);
}

// rb:test errors.wrong_method
/// errors.wrong_method: Rocket routes on the method and the path together, so a method
/// /items/<id> has no route for is 404, as a path with no route is.
#[test]
fn a_method_the_path_lacks_is_404() {
    let client = client();

    let response = post(&client, "/items/17", "application/json", "{}");

    assert_eq!(response.status(), Status::NotFound);
}

// rb:test errors.malformed
/// errors.malformed: a body that is not JSON fails Rocket's Json guard with 400 before any rule
/// runs, and Rocket's default catcher answers with its HTML page.
#[test]
fn a_body_that_is_not_json_is_400_from_the_guard() {
    let client = client();

    let response = post(&client, "/body/validate/small", "application/json", "{\"customerId\": 1, \"lines\": [");

    assert_eq!(response.status(), Status::BadRequest);
    assert_eq!(response.content_type(), Some(ContentType::HTML));
}

#[test]
fn a_catcher_answers_json_to_a_request_that_prefers_it() {
    let client = client();

    let response = client.get("/errors/unmatched").header(rocket::http::Accept::JSON).dispatch();

    assert_eq!(response.status(), Status::NotFound);
    assert_eq!(response.content_type(), Some(ContentType::JSON));
}
