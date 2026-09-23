use poem::endpoint::make_sync;
use poem::web::{Data, Json, Path};
use poem::{EndpointExt, Route, get, handler};
use serde::Serialize;

use crate::answers::Echoed;
use crate::{Payloads, Shared};

#[derive(Serialize)]
struct One {
    one: i64,
}

#[derive(Serialize)]
struct Two {
    one: i64,
    two: i64,
}

// rb:handler parameters.one
/// The capture bound as an integer by poem's Path extractor, which refuses anything else with 400.
#[handler]
fn one_capture(Path(one): Path<i64>, Data(&p): Data<&Shared>) -> Json<Echoed<'static, One>> {
    Json(Echoed::new(&p.small, One { one }))
}

// rb:handler parameters.two
/// Both captures, in the order the route names them.
#[handler]
fn two_captures(Path((one, two)): Path<(i64, i64)>, Data(&p): Data<&Shared>) -> Json<Echoed<'static, Two>> {
    Json(Echoed::new(&p.small, Two { one, two }))
}

/// parameters: router captures, each bound as an integer by poem's Path extractor. The router
/// prefers the literal segment of the static route.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/parameters/static/segment/literal", get(make_sync(move |_| Json(&p.small))))
        .at("/parameters/:one/segment/literal", get(one_capture.data(p)))
        .at("/parameters/:one/with-second/:two", get(two_captures.data(p)))
}
