use actix_web::web::{self, ServiceConfig};

/// baseline: the dispatch floor, with nothing serialised. actix-web sends a `&str` as text/plain.
pub fn configure(cfg: &mut ServiceConfig) {
    cfg.route("/plaintext", web::get().to(|| async { "Hello, World!" }));
}
