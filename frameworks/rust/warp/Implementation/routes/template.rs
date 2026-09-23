use askama::Template;
use warp::Filter;
use warp::http::StatusCode;
use warp::reply::Html;

use crate::payloads::Payload;
use crate::{Payloads, Routes, answer};

// rb:wiring template.*
/// Implementation/templates/items.html, which askama compiles into the binary when it is built.
#[derive(Template)]
#[template(path = "items.html")]
struct ItemsPage<'a> {
    body: &'a Payload,
}

fn page(body: &Payload) -> Result<Html<String>, StatusCode> {
    ItemsPage { body }.render().map(warp::reply::html).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
// rb:end

/// template: warp has no view layer, and askama is the engine the Rust frameworks without one
/// render with here.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler template.small
    let small = warp::path!("template" / "small").and(warp::get()).map(move || page(&p.small));
    // rb:handler template.medium
    let medium = warp::path!("template" / "medium").and(warp::get()).map(move || page(&p.medium));
    answer(small.or(medium).unify()).boxed()
}
