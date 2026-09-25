use loco_rs::prelude::*;

use crate::Payloads;

// template: assets/views/items.html, rendered per request by Loco's Tera view engine, which the
// view engine initializer adds and a handler extracts.

// rb:handler template.small
async fn small(ViewEngine(v): ViewEngine<TeraView>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::render().view(&v, "items.html", data!({ "body": &p.small }))
}

// rb:handler template.medium
async fn medium(ViewEngine(v): ViewEngine<TeraView>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::render().view(&v, "items.html", data!({ "body": &p.medium }))
}

pub fn routes() -> Routes {
    Routes::new().prefix("template").add("/small", get(small)).add("/medium", get(medium))
}
