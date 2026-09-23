use actix_cors::Cors;
use actix_web::HttpResponse;
use actix_web::http::Method;
use actix_web::web::{self, ServiceConfig};

use crate::Payloads;
use crate::serial;

/// cors: actix-cors's middleware wrapped around this family's scope and nowhere else. It answers a
/// preflight before the scope reaches a handler, so the handler's x-rb-serial is absent from it.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    let cors = &p.settings.cors;
    let method = Method::from_bytes(cors.method.as_bytes()).expect("settings.json's cors.method is a method");

    cfg.service(
        web::scope("/cors")
            // rb:wiring cors.*
            .wrap(Cors::default().allowed_origin(&cors.origin).allowed_methods([method]).allowed_header(cors.header.as_str()).max_age(cors.max_age_seconds as usize))
            // rb:handler cors.request
            .route("/small", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.small) })),
    );
}
