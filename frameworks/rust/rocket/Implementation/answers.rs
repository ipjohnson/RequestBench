use rocket::FromForm;
use serde::Serialize;

use crate::payloads::{Item, Payload};

/// A payload with the values a handler bound written back beside its own fields.
#[derive(Serialize)]
pub struct Echoed<'a, T> {
    size: &'a str,
    count: i64,
    items: &'a [Item],
    echo: T,
}

impl<'a, T> Echoed<'a, T> {
    pub fn new(payload: &'a Payload, echo: T) -> Self {
        Echoed { size: &payload.size, count: payload.count, items: &payload.items, echo }
    }
}

/// query.many's eight values, which forms.urlencoded posts as a form. Rocket's FromForm binds
/// both, from the query string and from the body, under the names the corpus sends.
#[derive(FromForm, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Search<'r> {
    page: i64,
    size: i64,
    status: &'r str,
    category: &'r str,
    sort: &'r str,
    q: &'r str,
    #[field(name = "minPrice")]
    min_price: i64,
    #[field(name = "maxPrice")]
    max_price: i64,
}
