use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// The header a handler writes its serial in.
pub const SERIAL: &str = "x-rb-serial";

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process. A
/// handler that writes it takes the next count, so an answer a cache replays carries the value it
/// was stored with.
pub fn next() -> String {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |since| since.as_millis());
    format!("{ms}|{}", LAST.fetch_add(1, Ordering::Relaxed) + 1)
}
