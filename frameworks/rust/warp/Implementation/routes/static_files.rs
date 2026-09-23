use warp::Filter;

use crate::{Payloads, Routes, answer};

/// static: warp's fs::dir over the payload directory, under /static. It answers GET and HEAD, and
/// writes the file's type, length and modification time.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler static.file
    // rb:wiring static.*
    answer(warp::path("static").and(warp::fs::dir(p.dir.clone()))).boxed()
}
