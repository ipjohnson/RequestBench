use actix_web::dev::ServiceRequest;
use actix_web::error::ErrorForbidden;
use actix_web::web::{self, ServiceConfig};
use actix_web_httpauth::extractors::bearer::BearerAuth;
use actix_web_httpauth::middleware::HttpAuthentication;

use crate::Payloads;

/// authorized: actix-web-httpauth's bearer middleware on this one resource. It reads the bearer
/// token from the Authorization header before the handler runs and hands it to the validator,
/// which refuses any token but settings.json's with 403.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    // rb:wiring authorized.*
    let bearer = HttpAuthentication::bearer(move |request: ServiceRequest, credentials: BearerAuth| async move {
        if credentials.token() == p.settings.token { Ok(request) } else { Err((ErrorForbidden("the bearer token is not the one this route accepts"), request)) }
    });

    cfg.service(web::resource("/authorized/small").wrap(bearer).route(web::get().to(move || async move { web::Json(&p.small) })));
}
