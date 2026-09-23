use salvo::http::StatusCode;

use crate::support::{expected, get, get_with, header, json, serial, service, status};

// rb:test cache.small,cache.medium,cache.large
/// cache.small, cache.medium and cache.large: a second request is the stored answer, serial and all.
#[tokio::test]
async fn a_second_request_is_the_stored_answer() {
    for size in ["small", "medium", "large"] {
        let service = service();
        let path = format!("/cache/{size}");

        let first = get(&service, &path).await;
        let second = get(&service, &path).await;

        assert_eq!(status(&second), StatusCode::OK);
        assert_eq!(serial(&first), serial(&second), "{path}");
        assert_eq!(json(second).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test cache.vary_one
/// cache.vary_one: the one header the route varies on keys the store.
#[tokio::test]
async fn one_vary_header_keys_the_store() {
    let service = service();

    let alpha = serial(&get_with(&service, "/cache/vary/one", &[("x-rb-tenant", "alpha")]).await);
    let beta = serial(&get_with(&service, "/cache/vary/one", &[("x-rb-tenant", "beta")]).await);

    assert_eq!(alpha, serial(&get_with(&service, "/cache/vary/one", &[("x-rb-tenant", "alpha")]).await));
    assert_ne!(alpha, beta);
}

// rb:test cache.vary_many
/// cache.vary_many: each of the three headers the route varies on keys the store.
#[tokio::test]
async fn each_of_three_vary_headers_keys_the_store() {
    let service = service();
    let web_eu_alpha = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "alpha")];
    let web_eu_beta = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "beta")];

    let first = serial(&get_with(&service, "/cache/vary/many", &web_eu_alpha).await);

    assert_eq!(first, serial(&get_with(&service, "/cache/vary/many", &web_eu_alpha).await));
    assert_ne!(first, serial(&get_with(&service, "/cache/vary/many", &web_eu_beta).await));
}

/// A stored answer and a replayed one both say what they vary on, because the hoop that writes Vary
/// sits outside the cache.
#[tokio::test]
async fn the_answer_says_what_it_varies_on_whether_stored_or_replayed() {
    let service = service();

    let stored = get(&service, "/cache/vary/many").await;
    let replayed = get(&service, "/cache/vary/many").await;

    assert_eq!(serial(&stored), serial(&replayed));
    for response in [&stored, &replayed] {
        assert_eq!(header(response, "vary"), Some("x-rb-channel, x-rb-region, x-rb-tenant"));
    }
}
