use rocket::http::Status;

use crate::support::{client, expected, get, header, json, serial};

// rb:test cache.small,cache.medium,cache.large
/// cache.small, cache.medium and cache.large: a second request is the stored answer, serial and all.
#[test]
fn a_second_request_is_the_stored_answer() {
    for size in ["small", "medium", "large"] {
        let client = client();
        let path = format!("/cache/{size}");

        let first = get(&client, &path, &[]);
        let second = get(&client, &path, &[]);

        assert_eq!(second.status(), Status::Ok);
        assert_eq!(serial(&first), serial(&second), "{path}");
        assert_eq!(header(&second, "content-type").as_deref(), Some("application/json"));
        assert_eq!(json(second), expected(&format!("items.{size}.json")));
    }
}

// rb:test cache.vary_one
/// cache.vary_one: the one header the route varies on keys the store.
#[test]
fn one_vary_header_keys_the_store() {
    let client = client();

    let alpha = serial(&get(&client, "/cache/vary/one", &[("x-rb-tenant", "alpha")]));
    let beta = serial(&get(&client, "/cache/vary/one", &[("x-rb-tenant", "beta")]));

    assert_eq!(alpha, serial(&get(&client, "/cache/vary/one", &[("x-rb-tenant", "alpha")])));
    assert_ne!(alpha, beta);
}

// rb:test cache.vary_many
/// cache.vary_many: each of the three headers the route varies on keys the store.
#[test]
fn each_of_three_vary_headers_keys_the_store() {
    let client = client();
    let web_eu_alpha = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "alpha")];
    let web_eu_beta = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "beta")];

    let first = serial(&get(&client, "/cache/vary/many", &web_eu_alpha));

    assert_eq!(first, serial(&get(&client, "/cache/vary/many", &web_eu_alpha)));
    assert_ne!(first, serial(&get(&client, "/cache/vary/many", &web_eu_beta)));
}

#[test]
fn the_answer_says_what_it_varies_on() {
    let client = client();

    let response = get(&client, "/cache/vary/many", &[]);

    assert_eq!(header(&response, "vary").as_deref(), Some("x-rb-channel, x-rb-region, x-rb-tenant"));
}
