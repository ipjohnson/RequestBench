use serde_json::json as literal;
use warp::http::StatusCode;

use crate::support::{app, get, json, with_echo};

// rb:test query.one
/// query.one: one value bound as an integer and echoed.
#[tokio::test]
async fn one_value_is_bound() {
    let response = get(&app(), "/query/one?page=417").await;

    assert_eq!(json(&response), with_echo("items.small.json", literal!({ "page": 417 })));
}

// rb:test query.many
/// query.many: eight values bound, percent-decoded and echoed, the numbers as integers.
#[tokio::test]
async fn eight_values_are_bound() {
    let path = "/query/many?page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000";

    let response = get(&app(), path).await;

    let echo = literal!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
    assert_eq!(json(&response), with_echo("items.small.json", echo));
}

#[tokio::test]
async fn a_query_that_does_not_bind_is_warps_400() {
    let response = get(&app(), "/query/one?page=many").await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(response.body(), "Invalid query string");
}
