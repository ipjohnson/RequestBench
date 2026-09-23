//! RequestBench target: Rocket. One stage per corpus family under routes/, each mounting its
//! routes and whatever its family needs on the one application.

mod answers;
pub mod payloads;
mod serial;

mod routes {
    pub mod authorized;
    pub mod baseline;
    pub mod body;
    pub mod cache;
    pub mod compressed;
    pub mod contract;
    pub mod cors;
    pub mod etag;
    pub mod forms;
    pub mod headers;
    pub mod items;
    pub mod json;
    pub mod middleware;
    pub mod parameters;
    pub mod query;
    pub mod sse;
    pub mod static_files;
    pub mod stream;
    pub mod template;
}

use rocket::{Build, Rocket};

pub use payloads::Payloads;

type Stage = fn(Rocket<Build>, &Payloads) -> Rocket<Build>;

const STAGES: [Stage; 19] = [
    routes::contract::stage,
    routes::authorized::stage,
    routes::baseline::stage,
    routes::body::stage,
    routes::cache::stage,
    routes::compressed::stage,
    routes::cors::stage,
    routes::etag::stage,
    routes::forms::stage,
    routes::headers::stage,
    routes::items::stage,
    routes::json::stage,
    routes::middleware::stage,
    routes::parameters::stage,
    routes::query::stage,
    routes::sse::stage,
    routes::static_files::stage,
    routes::stream::stage,
    routes::template::stage,
];

/// Every route, on a Rocket nothing is serving yet, so the suite can hand it requests. The
/// payloads become Rocket's managed state, which the handlers reach through the State guard.
/// template_dir defaults to the templates beside the code, relative to the working directory,
/// unless ROCKET_TEMPLATE_DIR names another.
pub fn app(payloads: Payloads) -> Rocket<Build> {
    let figment = rocket::Config::figment().join(("template_dir", "Implementation/templates"));
    let rocket = STAGES.iter().fold(rocket::custom(figment), |rocket, stage| stage(rocket, &payloads));
    rocket.manage(payloads)
}
