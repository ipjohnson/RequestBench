use askama::Template;
use axum::http::StatusCode;
use axum::response::Html;
use axum::routing::get;
use axum::Router;

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring template.*
/// Implementation/templates/items.html, which askama compiles into the binary when it is built.
#[derive(Template)]
#[template(path = "items.html")]
struct ItemsPage<'a> {
    body: &'a Payload,
}

fn page(body: &Payload) -> Result<Html<String>, StatusCode> {
    ItemsPage { body }.render().map(Html).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
// rb:end

/// template: axum has no view layer, and askama is the engine its own examples render with.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/template/small", get(move || async move { page(&p.small) }))
        .route("/template/medium", get(move || async move { page(&p.medium) }))
}
