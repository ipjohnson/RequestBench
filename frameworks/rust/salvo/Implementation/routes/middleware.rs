use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Serialised;

/// middleware: no-op hoops in front of the handler. Salvo's middleware is a handler hooped onto a
/// router, and a hoop on a route's own router runs for that route alone.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/middleware")
        .push(Router::with_path("none").get(Serialised(&p.small)))
        .push(hooped(Router::with_path("four"), 4).get(Serialised(&p.small)))
        .push(hooped(Router::with_path("sixteen"), 16).get(Serialised(&p.small)))
}

// rb:wiring middleware.*
/// A hoop that does nothing. Salvo runs the next handler once a hoop returns without ending the
/// flow, so the chain continues to the route.
#[handler]
async fn noop() {}

fn hooped(router: Router, count: usize) -> Router {
    (0..count).fold(router, |router, _| router.hoop(noop))
}
// rb:end
