use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Stamped;

/// etag: Salvo's CachingHeaders hoop on this family's router. It hashes the body the handler
/// wrote, writes the tag, and answers 304 when If-None-Match already names it. The body is built
/// and hashed before anything is compared, so a 304 saves the write and nothing else.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/etag")
        // rb:wiring etag.*
        .hoop(CachingHeaders::new())
        .push(Router::with_path("small").get(Stamped(&p.small)))
        .push(Router::with_path("large").get(Stamped(&p.large)))
}
