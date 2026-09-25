use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Search};

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

// query: the query string, bound into a struct by axum's Query extractor, the numbers as integers.

// rb:handler query.one
async fn one(Query(page): Query<Page>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(Echoed::new(&p.small, page))
}

// rb:handler query.many
async fn many(Query(search): Query<Search>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(Echoed::new(&p.small, search))
}

pub fn routes() -> Routes {
    Routes::new().prefix("query").add("/one", get(one)).add("/many", get(many))
}
