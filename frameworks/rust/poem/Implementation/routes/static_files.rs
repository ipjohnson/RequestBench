use poem::endpoint::StaticFilesEndpoint;
use poem::Route;

use crate::Payloads;

/// static: poem's StaticFilesEndpoint over the payload directory, nested at /static. It writes the
/// file's type, length, modification time and an ETag of its own.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    // rb:handler static.large,static.medium,static.small
    // rb:wiring static.*
    route.nest("/static", StaticFilesEndpoint::new(&p.dir))
}
