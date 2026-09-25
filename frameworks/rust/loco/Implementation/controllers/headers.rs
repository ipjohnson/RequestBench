use axum::http::HeaderMap;
use loco_rs::prelude::*;
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound<'a> {
    tenant: &'a str,
    request_id: &'a str,
    account: i64,
}

// headers: /headers reads no header, and /headers/bind reads three from axum's HeaderMap, the
// account parsed as an integer. A header that is missing or no integer is Loco's bad_request.

// rb:handler headers.few,headers.many
async fn unread(SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

// rb:handler headers.bind_few,headers.bind_many
async fn bind(headers: HeaderMap, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    let read = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    let (Some(tenant), Some(request_id), Some(account)) =
        (read("x-rb-tenant"), read("x-rb-request-id"), read("x-rb-account").and_then(|account| account.parse().ok()))
    else {
        return bad_request("x-rb-tenant, x-rb-request-id and x-rb-account are required, the account as an integer");
    };
    format::json(Echoed::new(&p.small, Bound { tenant, request_id, account }))
}

pub fn routes() -> Routes {
    Routes::new().prefix("headers").add("/", get(unread)).add("/bind", get(bind))
}
