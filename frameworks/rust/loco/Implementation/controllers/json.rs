use loco_rs::prelude::*;

use crate::Payloads;

// json: the payload, which Loco's format::json writes with serde_json.

// rb:handler json.small,cors.scoped
async fn small(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

// rb:handler json.medium
async fn medium(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.medium)
}

// rb:handler json.large
async fn large(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.large)
}

pub fn routes() -> Routes {
    Routes::new().prefix("json").add("/small", get(small)).add("/medium", get(medium)).add("/large", get(large))
}
