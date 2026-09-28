use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use actix_web::http::header::{HeaderName, HeaderValue};

const SERIAL: HeaderName = HeaderName::from_static("x-rb-serial");

static LAST: AtomicU64 = AtomicU64::new(0);

/// x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process,
/// whichever worker thread answers. A handler that writes it takes the next count, so an answer a
/// cache replays carries the value it was stored with.
pub fn fresh() -> (HeaderName, HeaderValue) {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |since| since.as_millis());
    let serial = format!("{ms}|{}", LAST.fetch_add(1, Ordering::Relaxed) + 1);
    (SERIAL, HeaderValue::try_from(serial).expect("digits and a bar are a header value"))
}
