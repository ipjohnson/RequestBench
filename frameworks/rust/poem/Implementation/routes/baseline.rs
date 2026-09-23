use poem::endpoint::make_sync;
use poem::{Route, get};

use crate::Payloads;

/// baseline: the dispatch floor, with nothing serialised.
pub fn add(route: Route, _: &'static Payloads) -> Route {
    route.at("/plaintext", get(make_sync(|_| "Hello, World!")))
}
