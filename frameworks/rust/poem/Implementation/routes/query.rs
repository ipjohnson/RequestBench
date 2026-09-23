use poem::web::{Data, Json, Query};
use poem::{EndpointExt, Route, get, handler};
use serde::{Deserialize, Serialize};

use crate::answers::{Echoed, Search};
use crate::{Payloads, Shared};

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

// rb:handler query.one
/// One value, bound by poem's Query extractor into a struct whose field names and types are the
/// binding.
#[handler]
fn one(Query(page): Query<Page>, Data(&p): Data<&Shared>) -> Json<Echoed<'static, Page>> {
    Json(Echoed::new(&p.small, page))
}

// rb:handler query.many
/// Eight values, the same way.
#[handler]
fn many(Query(search): Query<Search>, Data(&p): Data<&Shared>) -> Json<Echoed<'static, Search>> {
    Json(Echoed::new(&p.small, search))
}

/// query: the query string bound into a struct by poem's Query extractor.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/query/one", get(one.data(p)))
        .at("/query/many", get(many.data(p)))
}
