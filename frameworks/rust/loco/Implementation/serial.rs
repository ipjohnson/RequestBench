use std::sync::atomic::{AtomicU64, Ordering};

/// The header a handler writes its serial in.
pub const SERIAL: &str = "x-rb-serial";

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
/// so an answer a cache replays carries the value it was stored with.
pub fn next() -> u64 {
    LAST.fetch_add(1, Ordering::Relaxed) + 1
}
