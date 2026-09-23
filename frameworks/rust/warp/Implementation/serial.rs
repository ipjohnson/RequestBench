use std::sync::atomic::{AtomicU64, Ordering};

use warp::Reply;
use warp::reply::WithHeader;

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: one counter for the whole process. A handler that writes it takes the next value,
/// so an answer a cache replays carries the value it was stored with.
pub fn fresh<T: Reply>(reply: T) -> WithHeader<T> {
    warp::reply::with_header(reply, "x-rb-serial", LAST.fetch_add(1, Ordering::Relaxed) + 1)
}
