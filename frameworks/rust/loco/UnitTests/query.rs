use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::with_echo;

// rb:test query.one
/// query.one: the page bound as an integer.
#[tokio::test]
async fn one_value_is_bound() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/query/one?page=417").await;

        assert_eq!(response.json::<Value>(), with_echo("items.small.json", json!({ "page": 417 })));
    })
    .await;
}

// rb:test query.many
/// query.many: eight values bound into one struct, the numbers as integers.
#[tokio::test]
async fn eight_values_are_bound() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/query/many?page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000").await;

        let echo = json!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
        assert_eq!(response.json::<Value>(), with_echo("items.small.json", echo));
    })
    .await;
}
