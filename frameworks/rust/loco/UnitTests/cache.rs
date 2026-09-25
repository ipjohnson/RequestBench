use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::Value;

use crate::support::{expected, serial};

// rb:test cache.small,cache.medium,cache.large
/// cache.small, cache.medium and cache.large: a second request is the stored answer, with the
/// serial it was stored with.
#[tokio::test]
async fn a_second_request_is_the_stored_answer() {
    request::<App, _, _>(|server, _| async move {
        for size in ["small", "medium", "large"] {
            let path = format!("/cache/{size}");
            let first = server.get(&path).await;
            let second = server.get(&path).await;

            assert_eq!(second.json::<Value>(), expected(&format!("items.{size}.json")), "{size}");
            assert_eq!(serial(&second), serial(&first), "{size}");
        }
    })
    .await;
}

// rb:test cache.vary_one
/// cache.vary_one: one vary header keys the store, and the answer says so.
#[tokio::test]
async fn one_vary_header_keys_the_store() {
    request::<App, _, _>(|server, _| async move {
        let alpha = server.get("/cache/vary/one").add_header("x-rb-tenant", "alpha").await;
        let beta = server.get("/cache/vary/one").add_header("x-rb-tenant", "beta").await;
        let again = server.get("/cache/vary/one").add_header("x-rb-tenant", "alpha").await;

        assert_eq!(serial(&again), serial(&alpha));
        assert_ne!(serial(&beta), serial(&alpha));
        assert_eq!(again.header("vary"), "x-rb-tenant");
    })
    .await;
}

// rb:test cache.vary_many
/// cache.vary_many: each of three vary headers keys the store.
#[tokio::test]
async fn each_of_three_vary_headers_keys_the_store() {
    request::<App, _, _>(|server, _| async move {
        let get = |channel: &'static str, region: &'static str, tenant: &'static str| {
            server.get("/cache/vary/many").add_header("x-rb-channel", channel).add_header("x-rb-region", region).add_header("x-rb-tenant", tenant)
        };
        let first = get("web", "eu", "alpha").await;

        assert_eq!(serial(&get("web", "eu", "alpha").await), serial(&first));
        assert_ne!(serial(&get("web", "eu", "beta").await), serial(&first));
        assert_ne!(serial(&get("web", "us", "alpha").await), serial(&first));
        assert_ne!(serial(&get("app", "eu", "alpha").await), serial(&first));
    })
    .await;
}
