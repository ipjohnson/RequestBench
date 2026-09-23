use salvo::prelude::*;
use salvo::serve_static::StaticDir;

use crate::Payloads;

/// static: Salvo's StaticDir over the payload directory, under /static. It writes the file's type,
/// length and modification time.
pub fn router(p: &'static Payloads) -> Router {
    // rb:handler static.file
    // rb:wiring static.*
    Router::with_path("/static/{*path}").get(StaticDir::new([&p.dir]))
}
