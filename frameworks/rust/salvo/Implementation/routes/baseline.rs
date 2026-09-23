use salvo::prelude::*;

// rb:handler baseline.plaintext
/// Salvo writes a `&'static str` as text/plain.
#[handler]
async fn plaintext() -> &'static str {
    "Hello, World!"
}

/// baseline: the dispatch floor, with nothing serialised.
pub fn router() -> Router {
    Router::with_path("/plaintext").get(plaintext)
}
