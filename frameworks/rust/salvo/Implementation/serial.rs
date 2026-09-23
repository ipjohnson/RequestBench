use std::sync::atomic::{AtomicU64, Ordering};

use salvo::http::HeaderValue;
use salvo::http::header::HeaderName;
use salvo::prelude::*;

const SERIAL: HeaderName = HeaderName::from_static("x-rb-serial");

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
/// so an answer a cache replays carries the value it was stored with.
pub fn stamp(res: &mut Response) {
    res.headers_mut().insert(SERIAL, HeaderValue::from(LAST.fetch_add(1, Ordering::Relaxed) + 1));
}
