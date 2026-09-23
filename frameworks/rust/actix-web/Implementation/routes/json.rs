use actix_web::web::{self, ServiceConfig};

use crate::Payloads;

/// json: a payload the framework already holds, serialised at three sizes by actix-web's Json
/// responder.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/json/small", web::get().to(move || async move { web::Json(&p.small) }))
        .route("/json/medium", web::get().to(move || async move { web::Json(&p.medium) }))
        .route("/json/large", web::get().to(move || async move { web::Json(&p.large) }));
}
