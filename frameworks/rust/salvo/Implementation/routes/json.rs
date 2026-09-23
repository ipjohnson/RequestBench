use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Serialised;

/// json: a payload the framework already holds, serialised at three sizes.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/json")
        .push(Router::with_path("small").get(Serialised(&p.small)))
        .push(Router::with_path("medium").get(Serialised(&p.medium)))
        .push(Router::with_path("large").get(Serialised(&p.large)))
}
