use serde::{Deserialize, Serialize};
use warp::Filter;

use crate::answers::{Echoed, Search};
use crate::{Payloads, Routes, answer};

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

/// query: the query string bound into a struct by warp's query filter, where the field names and
/// types are the binding. A query that does not bind is warp's own 400.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler query.one
    let one = warp::path!("query" / "one").and(warp::get()).and(warp::query::<Page>()).map(move |page: Page| warp::reply::json(&Echoed::new(&p.small, page)));
    // rb:handler query.many
    let many = warp::path!("query" / "many").and(warp::get()).and(warp::query::<Search>()).map(move |search: Search| warp::reply::json(&Echoed::new(&p.small, search)));
    answer(one.or(many).unify()).boxed()
}
