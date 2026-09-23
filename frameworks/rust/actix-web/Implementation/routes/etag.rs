use actix_middleware_etag::Etag;
use actix_web::HttpResponse;
use actix_web::web::{self, ServiceConfig};

use crate::Payloads;
use crate::serial;

/// etag: actix-web computes no validator for an answer a handler builds, so this family is
/// actix-middleware-etag's, a middleware written for actix-web, wrapped around its scope. It hashes
/// what the handler answered and answers 304 when If-None-Match already names the hash. The body
/// is built and hashed before anything is compared, so a 304 saves the write and nothing else.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.service(
        web::scope("/etag")
            // rb:wiring etag.*
            .wrap(Etag::default())
            // rb:handler etag.small
            .route("/small", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.small) }))
            // rb:handler etag.large,etag.match_large,etag.stale_large
            .route("/large", web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.large) })),
    );
}
