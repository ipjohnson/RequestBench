use std::sync::atomic::{AtomicU64, Ordering};

use poem::IntoResponse;
use poem::web::WithHeader;

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
/// so an answer a cache replays carries the value it was stored with.
pub fn fresh<T: IntoResponse>(answer: T) -> WithHeader<T> {
    answer.with_header("x-rb-serial", LAST.fetch_add(1, Ordering::Relaxed) + 1)
}
