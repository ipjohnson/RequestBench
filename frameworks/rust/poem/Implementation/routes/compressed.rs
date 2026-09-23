use poem::endpoint::make_sync;
use poem::middleware::Compression;
use poem::web::{CompressionLevel, Json};
use poem::{EndpointExt, Route, get};

use crate::{Payloads, serial};

/// compressed: these routes answer like any other. poem's compression middleware, on this family's
/// routes alone, compresses the answer when the request asks for it.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/compressed/small", get(make_sync(move |_| serial::fresh(Json(&p.small)))).with(gzip()))
        .at("/compressed/large", get(make_sync(move |_| serial::fresh(Json(&p.large)))).with(gzip()))
}

// rb:wiring compressed.*
/// gzip at the fastest level every framework here compresses at. The middleware has no size
/// threshold, so it compresses a body of any length when the request accepts gzip.
fn gzip() -> Compression {
    Compression::new().with_quality(CompressionLevel::Fastest)
}
// rb:end
