use axum::extract::Query;
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Search};

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

/// query: the query string bound into a struct by axum's Query extractor, where the field names
/// and types are the binding.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/query/one", get(move |Query(page): Query<Page>| async move { Json(Echoed::new(&p.small, page)) }))
        .route("/query/many", get(move |Query(search): Query<Search>| async move { Json(Echoed::new(&p.small, search)) }))
}
