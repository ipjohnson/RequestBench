use std::sync::Arc;

use poem::endpoint::make_sync;
use poem::error::InternalServerError;
use poem::web::Html;
use poem::{Result, Route, get};
use tera::{Context, Tera};

use crate::Payloads;
use crate::payloads::Payload;

// rb:wiring template.*
/// Implementation/templates/items.html, compiled into the binary and parsed by Tera once, when the
/// application is built. poem has no view layer, and its own templating example renders with Tera.
fn templates() -> Tera {
    let mut tera = Tera::new();
    tera.add_raw_template("items.html", include_str!("../templates/items.html")).expect("items.html is a Tera template");
    tera
}

/// The page for one payload. Tera renders from a context, so the payload is serialised into one on
/// every request.
fn page(tera: &Tera, body: &Payload) -> Result<Html<String>> {
    let mut context = Context::new();
    context.insert("body", body);
    tera.render("items.html", &context).map(Html).map_err(InternalServerError)
}
// rb:end

/// template: the payloads rendered as a page.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    let small = Arc::new(templates());
    let medium = small.clone();
    route
        .at("/template/small", get(make_sync(move |_| page(&small, &p.small))))
        .at("/template/medium", get(make_sync(move |_| page(&medium, &p.medium))))
}
