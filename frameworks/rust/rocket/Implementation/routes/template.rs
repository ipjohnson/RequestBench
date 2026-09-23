use rocket::{Build, Rocket, State, get, routes};
use rocket_dyn_templates::{Template, context};

use crate::Payloads;

/// template: Rocket's own view layer, rocket_dyn_templates, rendering
/// Implementation/templates/items-page.html.tera with Tera, the engine the file's extension names.
/// A template named `items` would read as the /items route to the snippet finder.
#[get("/template/small")]
fn small(p: &State<Payloads>) -> Template {
    Template::render("items-page", context! { body: &p.small })
}

#[get("/template/medium")]
fn medium(p: &State<Payloads>) -> Template {
    Template::render("items-page", context! { body: &p.medium })
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket
        .mount("/", routes![small, medium])
        // rb:wiring template.*
        // The fairing reads every template in template_dir from disk when Rocket ignites.
        .attach(Template::fairing())
}
