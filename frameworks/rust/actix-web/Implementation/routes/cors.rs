use actix_cors::Cors;
use actix_web::HttpResponse;
use actix_web::http::Method;
use actix_web::web::{self, ServiceConfig};

use crate::Payloads;
use crate::serial;

/// cors: actix-cors's middleware wrapped around this family's scope and nowhere else. It answers a
/// preflight before the scope reaches a handler, so the handler's x-rb-serial is absent from it.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.service(
        web::scope("/cors")
            // rb:wiring cors.*
            .wrap(Cors::default().allowed_origin("https://shop.example.com").allowed_methods([Method::GET]).allowed_header("x-rb-tenant").max_age(600))
            // rb:handler cors.request
            .route("/small", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.small) })),
    );
}
