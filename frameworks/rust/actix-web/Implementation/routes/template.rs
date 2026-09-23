use actix_web::HttpResponse;
use actix_web::http::header::ContentType;
use actix_web::web::{self, ServiceConfig};
use askama::Template;

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring template.*
/// Implementation/templates/items.html, which askama compiles into the binary when it is built.
#[derive(Template)]
#[template(path = "items.html")]
struct ItemsPage<'a> {
    body: &'a Payload,
}

fn page(body: &Payload) -> HttpResponse {
    match (ItemsPage { body }).render() {
        Ok(html) => HttpResponse::Ok().content_type(ContentType::html()).body(html),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}
// rb:end

/// template: actix-web has no view layer, and askama is the engine axum's own examples render with.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/template/small", web::get().to(move || async move { page(&p.small) }))
        .route("/template/medium", web::get().to(move || async move { page(&p.medium) }));
}
