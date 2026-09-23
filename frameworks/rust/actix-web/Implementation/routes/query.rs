use actix_web::web::{self, ServiceConfig};
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Search};

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

/// query: the query string bound into a struct by actix-web's Query extractor, where the field
/// names and types are the binding.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/query/one", web::get().to(move |page: web::Query<Page>| async move { web::Json(Echoed::new(&p.small, page.into_inner())) }))
        .route("/query/many", web::get().to(move |search: web::Query<Search>| async move { web::Json(Echoed::new(&p.small, search.into_inner())) }));
}
