use actix_web::HttpResponse;
use actix_web::middleware::Compress;
use actix_web::web::{self, ServiceConfig};

use crate::Payloads;
use crate::serial;

/// compressed: these routes answer like any other. actix-web's Compress middleware, wrapped around
/// this family's scope alone, gzips the answer when the request asks for it.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.service(
        web::scope("/compressed")
            // rb:wiring compressed.*
            // Compress takes no level. actix-http gzips at flate2's fast level, which is level 1,
            // and compresses a body of any size.
            .wrap(Compress::default())
            // rb:handler compressed.gzip_small,compressed.identity_small
            .route("/small", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.small) }))
            // rb:handler compressed.gzip_large,compressed.identity_large
            .route("/large", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.large) })),
    );
}
