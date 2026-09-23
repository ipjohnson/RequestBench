use warp::Filter;

use crate::{Routes, answer};

/// baseline: the dispatch floor, with nothing serialised. warp sends a &str as text/plain.
pub fn routes() -> Routes {
    // rb:handler baseline.plaintext
    answer(warp::path!("plaintext").and(warp::get()).map(|| "Hello, World!")).boxed()
}
