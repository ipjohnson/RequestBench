use loco_rs::prelude::*;

use crate::Payloads;
use crate::serial::{self, SERIAL};

// compressed: the payload with x-rb-serial, so an answer that went out compressed is still the
// handler's. Loco's compression middleware, which the config file turns on, compresses it.

// rb:handler compressed.gzip_small,compressed.identity_small
async fn small(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::render().header(SERIAL, serial::next()).json(&p.small)
}

// rb:handler compressed.gzip_large,compressed.identity_large
async fn large(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::render().header(SERIAL, serial::next()).json(&p.large)
}

pub fn routes() -> Routes {
    Routes::new().prefix("compressed").add("/small", get(small)).add("/large", get(large))
}
