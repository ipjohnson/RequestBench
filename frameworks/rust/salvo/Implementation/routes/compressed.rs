use salvo::compression::{Compression, CompressionLevel};
use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Stamped;

/// compressed: these routes answer like any other. Salvo's compression hoop, on this family's
/// router alone, gzips the answer when the request asks for it.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/compressed")
        // rb:wiring compressed.*
        // gzip at the fastest level every framework here compresses at, which is also what Salvo
        // means by its default for gzip, and the default threshold, which leaves a body under
        // 1024 bytes alone.
        .hoop(Compression::new().enable_gzip(CompressionLevel::Fastest))
        .push(Router::with_path("small").get(Stamped(&p.small)))
        .push(Router::with_path("large").get(Stamped(&p.large)))
}
