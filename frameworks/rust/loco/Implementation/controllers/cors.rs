use loco_rs::controller::middleware::cors::Cors;
use loco_rs::prelude::*;

use crate::Payloads;
use crate::serial::{self, SERIAL};

// rb:handler cors.request,cors.vary
async fn small(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::render().header(SERIAL, serial::next()).json(&p.small)
}

/// cors: the one policy on the cors routes alone. Loco's cors middleware in the config file
/// would cover every route, so the policy is Loco's Cors, the middleware's own settings, made into
/// its layer and added with Routes::layer. The layer answers a preflight before any handler runs.
pub fn routes() -> Routes {
    // rb:wiring cors.*
    let policy = Cors {
        enable: true,
        allow_origins: vec!["https://shop.example.com".to_owned()],
        allow_headers: vec!["x-rb-tenant".to_owned()],
        allow_methods: vec!["GET".to_owned()],
        max_age: Some(600),
        ..Cors::default()
    };
    Routes::new().prefix("cors").add("/small", get(small)).layer(policy.cors().expect("the CORS policy parses"))
    // rb:end
}
