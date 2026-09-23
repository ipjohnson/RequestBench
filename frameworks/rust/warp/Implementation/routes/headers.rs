use serde::Serialize;
use warp::Filter;

use crate::answers::Echoed;
use crate::{Payloads, Routes, answer};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound {
    tenant: String,
    request_id: String,
    account: i64,
}

/// headers: /headers reads no header, and /headers/bind binds three with warp's header filter, which
/// converts each with FromStr, the account to an integer. A header that is missing or that does not
/// convert is warp's own 400.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler headers.few,headers.many
    let plain = warp::path!("headers").and(warp::get()).map(move || warp::reply::json(&p.small));
    // rb:handler headers.bind_few,headers.bind_many
    let bind = warp::path!("headers" / "bind").and(warp::get()).and(warp::header::<String>("x-rb-tenant")).and(warp::header::<String>("x-rb-request-id")).and(warp::header::<i64>("x-rb-account")).map(move |tenant, request_id, account| warp::reply::json(&Echoed::new(&p.small, Bound { tenant, request_id, account })));
    answer(plain.or(bind).unify()).boxed()
}
