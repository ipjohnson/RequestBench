use std::sync::atomic::{AtomicU64, Ordering};

use rocket::Responder;
use rocket::http::Header;

static LAST: AtomicU64 = AtomicU64::new(0);

/// An answer with x-rb-serial: one counter for the whole process. A handler that writes it takes
/// the next value, so an answer a cache replays carries the value it was stored with.
#[derive(Responder)]
pub struct Fresh<R> {
    inner: R,
    serial: Header<'static>,
}

impl<R> Fresh<R> {
    pub fn new(inner: R) -> Self {
        Fresh { inner, serial: next() }
    }
}

pub fn next() -> Header<'static> {
    Header::new("x-rb-serial", (LAST.fetch_add(1, Ordering::Relaxed) + 1).to_string())
}
