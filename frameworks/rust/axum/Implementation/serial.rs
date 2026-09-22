use std::sync::atomic::{AtomicU64, Ordering};

use axum::http::{HeaderName, HeaderValue};

const SERIAL: HeaderName = HeaderName::from_static("x-rb-serial");

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
/// so an answer a cache replays carries the value it was stored with.
pub fn fresh() -> [(HeaderName, HeaderValue); 1] {
    [(SERIAL, HeaderValue::from(LAST.fetch_add(1, Ordering::Relaxed) + 1))]
}
