use actix_web::http::StatusCode;

use crate::support::{app, expected, header, json, serial};

// rb:test cache.small,cache.medium,cache.large
/// cache.small, cache.medium and cache.large: a second request is the stored answer, serial and all.
#[actix_web::test]
async fn a_second_request_is_the_stored_answer() {
    let app = app().await;
    for size in ["small", "medium", "large"] {
        let path = format!("/cache/{size}");

        let first = app.get(&path).await;
        let second = app.get(&path).await;

        assert_eq!(second.status(), StatusCode::OK);
        assert_eq!(serial(&first), serial(&second), "{path}");
        assert_eq!(json(second).await, expected(&format!("items.{size}.json")));
    }
}

// rb:test cache.vary_one
/// cache.vary_one: the one header the route varies on keys the store.
#[actix_web::test]
async fn one_vary_header_keys_the_store() {
    let app = app().await;

    let alpha = serial(&app.get_with("/cache/vary/one", &[("x-rb-tenant", "alpha")]).await);
    let beta = serial(&app.get_with("/cache/vary/one", &[("x-rb-tenant", "beta")]).await);

    assert_eq!(alpha, serial(&app.get_with("/cache/vary/one", &[("x-rb-tenant", "alpha")]).await));
    assert_ne!(alpha, beta);
}

// rb:test cache.vary_many
/// cache.vary_many: each of the three headers the route varies on keys the store.
#[actix_web::test]
async fn each_of_three_vary_headers_keys_the_store() {
    let app = app().await;
    let web_eu_alpha = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "alpha")];
    let web_eu_beta = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "beta")];

    let first = serial(&app.get_with("/cache/vary/many", &web_eu_alpha).await);

    assert_eq!(first, serial(&app.get_with("/cache/vary/many", &web_eu_alpha).await));
    assert_ne!(first, serial(&app.get_with("/cache/vary/many", &web_eu_beta).await));
}

#[actix_web::test]
async fn the_answer_says_what_it_varies_on() {
    let response = app().await.get("/cache/vary/many").await;

    assert_eq!(header(&response, "vary"), Some("x-rb-channel, x-rb-region, x-rb-tenant"));
}

#[actix_web::test]
async fn a_stored_answer_is_replayed_with_its_headers() {
    let app = app().await;
    app.get_with("/cache/vary/one", &[("x-rb-tenant", "alpha")]).await;

    let replayed = app.get_with("/cache/vary/one", &[("x-rb-tenant", "alpha")]).await;

    assert_eq!(header(&replayed, "content-type"), Some("application/json"));
    assert_eq!(header(&replayed, "vary"), Some("x-rb-tenant"));
}
