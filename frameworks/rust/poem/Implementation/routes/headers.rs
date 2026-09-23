use poem::endpoint::make_sync;
use poem::http::{HeaderMap, StatusCode};
use poem::web::{Data, Json};
use poem::{EndpointExt, Route, get, handler};
use serde::Serialize;

use crate::answers::Echoed;
use crate::{Payloads, Shared};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound {
    tenant: String,
    request_id: String,
    account: i64,
}

impl Bound {
    /// poem's TypedHeader binds only the headers the headers crate defines, and none of these. A
    /// handler reads the others from the HeaderMap poem extracts for it. A header that is missing
    /// or that does not convert is a 400.
    fn from(headers: &HeaderMap) -> Option<Bound> {
        let text = |name: &str| headers.get(name)?.to_str().ok();
        Some(Bound {
            tenant: text("x-rb-tenant")?.to_owned(),
            request_id: text("x-rb-request-id")?.to_owned(),
            account: text("x-rb-account")?.parse().ok()?,
        })
    }
}

// rb:handler headers.bind_few,headers.bind_many
#[handler]
fn bind(headers: &HeaderMap, Data(&p): Data<&Shared>) -> Result<Json<Echoed<'static, Bound>>, StatusCode> {
    Bound::from(headers).map(|bound| Json(Echoed::new(&p.small, bound))).ok_or(StatusCode::BAD_REQUEST)
}

/// headers: /headers reads no header, and /headers/bind reads three from the HeaderMap poem
/// extracts for it, the account as an integer.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/headers", get(make_sync(move |_| Json(&p.small))))
        .at("/headers/bind", get(bind.data(p)))
}
