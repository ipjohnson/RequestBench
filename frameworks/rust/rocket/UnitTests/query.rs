use serde_json::json as literal;

use crate::support::{client, get, json, with_echo};

// rb:test query.one
/// query.one: one value bound as an integer and echoed.
#[test]
fn one_value_is_bound() {
    let client = client();

    let response = get(&client, "/query/one?page=417", &[]);

    assert_eq!(json(response), with_echo("items.small.json", literal!({ "page": 417 })));
}

// rb:test query.many
/// query.many: eight values bound, percent-decoded and echoed, the numbers as integers.
#[test]
fn eight_values_are_bound() {
    let client = client();
    let path = "/query/many?page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000";

    let response = get(&client, path, &[]);

    let echo = literal!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
    assert_eq!(json(response), with_echo("items.small.json", echo));
}
