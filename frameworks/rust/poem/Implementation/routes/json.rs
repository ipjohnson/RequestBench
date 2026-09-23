use poem::endpoint::make_sync;
use poem::web::Json;
use poem::{Route, get};

use crate::Payloads;

/// json: a payload the framework already holds, serialised at three sizes.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/json/small", get(make_sync(move |_| Json(&p.small))))
        .at("/json/medium", get(make_sync(move |_| Json(&p.medium))))
        .at("/json/large", get(make_sync(move |_| Json(&p.large))))
}
