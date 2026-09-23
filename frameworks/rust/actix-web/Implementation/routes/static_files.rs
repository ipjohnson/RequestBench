use actix_files::Files;
use actix_web::web::ServiceConfig;

use crate::Payloads;

/// static: actix-files serving the payload directory at /static. It writes the file's type, its
/// length, its modification time and an ETag.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    // rb:handler static.file
    // rb:wiring static.*
    cfg.service(Files::new("/static", &p.dir));
}
