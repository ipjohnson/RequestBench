use actix_web::Error;
use actix_web::body::MessageBody;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::middleware::{Next, from_fn};
use actix_web::web::{self, ServiceConfig};

use crate::Payloads;

// rb:wiring middleware.*
async fn noop(request: ServiceRequest, next: Next<impl MessageBody>) -> Result<ServiceResponse<impl MessageBody>, Error> {
    next.call(request).await
}

/// Each wrap changes the resource's type, so the layers are written out rather than folded.
macro_rules! noops {
    ($resource:expr, 1) => { $resource.wrap(from_fn(noop)) };
    ($resource:expr, 4) => { noops!(noops!(noops!(noops!($resource, 1), 1), 1), 1) };
    ($resource:expr, 16) => { noops!(noops!(noops!(noops!($resource, 4), 4), 4), 4) };
}
// rb:end

/// middleware: no-op middleware in front of the handler. from_fn makes actix-web middleware of an
/// async function, and wrapped around the route's resource it runs for that route alone.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/middleware/none", web::get().to(move || async move { web::Json(&p.small) }))
        .service(noops!(web::resource("/middleware/four").route(web::get().to(move || async move { web::Json(&p.small) })), 4))
        .service(noops!(web::resource("/middleware/sixteen").route(web::get().to(move || async move { web::Json(&p.small) })), 16));
}
