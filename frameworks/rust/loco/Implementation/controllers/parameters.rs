use loco_rs::prelude::*;
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

// parameters: path captures, each bound as an integer by axum's Path extractor, which refuses one
// that is not with 400.

// rb:handler parameters.static
async fn literal(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

// rb:handler parameters.one
async fn one(Path(one): Path<i64>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(Echoed::new(&p.small, One { one }))
}

// rb:handler parameters.two
async fn two(Path((one, two)): Path<(i64, i64)>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(Echoed::new(&p.small, Two { one, two }))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("parameters")
        .add("/static/segment/literal", get(literal))
        .add("/{one}/segment/literal", get(one))
        .add("/{one}/with-second/{two}", get(two))
}
