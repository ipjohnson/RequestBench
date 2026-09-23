use actix_web::web::{self, ServiceConfig};
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::Echoed;

#[derive(Deserialize, Serialize)]
struct One {
    one: i64,
}

#[derive(Deserialize, Serialize)]
struct Two {
    one: i64,
    two: i64,
}

/// parameters: router captures, bound as integers into a struct by actix-web's Path extractor,
/// which names each field after its capture. The router tries routes in the order they were
/// registered, so the literal route comes first.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/parameters/static/segment/literal", web::get().to(move || async move { web::Json(&p.small) }))
        .route("/parameters/{one}/segment/literal", web::get().to(move |one: web::Path<One>| async move { web::Json(Echoed::new(&p.small, one.into_inner())) }))
        .route("/parameters/{one}/with-second/{two}", web::get().to(move |two: web::Path<Two>| async move { web::Json(Echoed::new(&p.small, two.into_inner())) }));
}
