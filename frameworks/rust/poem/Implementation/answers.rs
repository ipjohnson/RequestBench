use serde::{Deserialize, Serialize};

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

/// query.many's eight values, which forms.urlencoded posts as a form.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Search {
    page: i64,
    size: i64,
    status: String,
    category: String,
    sort: String,
    q: String,
    min_price: i64,
    max_price: i64,
}
