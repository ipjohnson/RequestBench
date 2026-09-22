use axum::Router;
use tower_http::services::ServeDir;

use crate::Payloads;

/// static: tower-http's ServeDir over the payload directory, nested at /static. It writes the
/// file's type, length and modification time.
pub fn router(p: &'static Payloads) -> Router {
    // rb:handler static.file
    // rb:wiring static.*
    Router::new().nest_service("/static", ServeDir::new(&p.dir))
}
