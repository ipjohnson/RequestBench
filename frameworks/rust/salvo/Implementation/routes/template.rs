use askama::Template;
use salvo::prelude::*;

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring template.*
/// Implementation/templates/items.html, which askama compiles into the binary when it is built.
#[derive(Template)]
#[template(path = "items.html")]
struct ItemsPage<'a> {
    body: &'a Payload,
}
// rb:end

// rb:handler template.small,template.medium
/// The page a payload renders, written as text/html.
#[derive(Clone, Copy)]
struct Page(&'static Payload);

#[handler]
impl Page {
    async fn handle(&self) -> Result<Text<String>, StatusError> {
        ItemsPage { body: self.0 }.render().map(Text::Html).map_err(|_| StatusError::internal_server_error())
    }
}
// rb:end

/// template: Salvo has no view layer, and askama is the engine Salvo's own template example
/// renders with.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/template")
        .push(Router::with_path("small").get(Page(&p.small)))
        .push(Router::with_path("medium").get(Page(&p.medium)))
}
