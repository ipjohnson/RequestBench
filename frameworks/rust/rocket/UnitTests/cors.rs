use rocket::http::{Header, Status};
use rocket::local::blocking::{Client, LocalResponse};

use crate::support::{client, expected, get, header, json, payloads};

fn origin() -> String {
    payloads().settings.cors.origin
}

fn preflight<'c>(client: &'c Client, from: &str) -> LocalResponse<'c> {
    client
        .options("/cors/small")
        .header(Header::new("origin", from.to_owned()))
        .header(Header::new("access-control-request-method", "GET"))
        .header(Header::new("access-control-request-headers", "x-rb-tenant"))
        .dispatch()
}

// rb:test cors.preflight
/// cors.preflight: rocket_cors's OPTIONS route answers the preflight, so no handler's x-rb-serial.
#[test]
fn the_crate_answers_a_preflight_before_any_handler() {
    let client = client();

    let response = preflight(&client, &origin());

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert_eq!(header(&response, "access-control-allow-headers").map(|h| h.to_lowercase()).as_deref(), Some("x-rb-tenant"));
    assert_eq!(header(&response, "access-control-max-age").as_deref(), Some("600"));
    assert_eq!(header(&response, "x-rb-serial"), None);
}

// rb:test cors.disallowed
/// cors.disallowed: a preflight from another origin gets no access-control-allow-origin.
#[test]
fn a_preflight_from_another_origin_is_not_allowed() {
    let client = client();

    let response = preflight(&client, "https://elsewhere.example.net");

    assert_eq!(header(&response, "access-control-allow-origin"), None);
}

// rb:test cors.request
/// cors.request: the request itself passes the guard and reaches the handler.
#[test]
fn the_request_itself_reaches_the_handler() {
    let client = client();

    let response = get(&client, "/cors/small", &[("origin", &origin()), ("x-rb-tenant", "qwertyuiopas")]);

    assert_eq!(header(&response, "access-control-allow-origin"), Some(origin()));
    assert!(header(&response, "x-rb-serial").is_some());
    assert_eq!(json(response), expected("items.small.json"));
}

// rb:test cors.vary
/// cors.vary: rb.json skips it, because rocket_cors writes Vary: Origin only when it allows every
/// origin. When it writes one for a single origin, this fails and the skip can go.
#[test]
fn the_answer_does_not_vary_on_origin() {
    let client = client();

    let response = get(&client, "/cors/small", &[("origin", &origin())]);

    assert_eq!(header(&response, "vary"), None);
}

// rb:test cors.scoped
/// cors.scoped: a route that takes no guard gets no policy.
#[test]
fn a_route_outside_cors_gets_no_policy() {
    let client = client();

    let response = get(&client, "/json/small", &[("origin", &origin())]);

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(header(&response, "access-control-allow-origin"), None);
}
