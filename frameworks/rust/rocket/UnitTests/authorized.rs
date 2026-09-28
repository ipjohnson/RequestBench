use rocket::http::Status;

use crate::support::{client, expected, get, json};

// rb:test authorized.allowed
/// authorized.allowed: the one bearer token passes the guard and reaches the handler.
#[test]
fn the_token_reaches_the_handler() {
    let client = client();
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c317".to_owned();

    let response = get(&client, "/authorized/small", &[("authorization", &token)]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(json(response), expected("items.small.json"));
}

// rb:test authorized.denied
/// authorized.denied: a token that differs in its last character fails the guard with 403 before
/// the handler runs.
#[test]
fn another_token_is_forbidden() {
    let client = client();
    let token = "Bearer 5a7cc77ed0dcb825806b6f872026c310".to_owned();

    let response = get(&client, "/authorized/small", &[("authorization", &token)]);

    assert_eq!(response.status(), Status::Forbidden);
}

#[test]
fn no_token_is_forbidden() {
    let client = client();

    let response = get(&client, "/authorized/small", &[]);

    assert_eq!(response.status(), Status::Forbidden);
}
