use loco_rs::prelude::*;

// rb:handler baseline.plaintext
/// baseline: the string, which Loco's format::text writes as text/plain.
async fn plaintext() -> Result<Response> {
    format::text("Hello, World!")
}

pub fn routes() -> Routes {
    Routes::new().add("/plaintext", get(plaintext))
}
