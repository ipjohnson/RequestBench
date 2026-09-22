use axum::extract::Path;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;

#[derive(Serialize)]
struct One {
    one: i64,
}

#[derive(Serialize)]
struct Two {
    one: i64,
    two: i64,
}

/// parameters: router captures, each bound as an integer by axum's Path extractor. The router
/// prefers the literal segment of the static route.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/parameters/static/segment/literal", get(move || async move { Json(&p.small) }))
        .route("/parameters/{one}/segment/literal", get(move |Path(one): Path<i64>| async move {
            Json(Echoed::new(&p.small, One { one }))
        }))
        .route("/parameters/{one}/with-second/{two}", get(move |Path((one, two)): Path<(i64, i64)>| async move {
            Json(Echoed::new(&p.small, Two { one, two }))
        }))
}
