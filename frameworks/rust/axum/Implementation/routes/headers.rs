use axum::http::{HeaderMap, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound {
    tenant: String,
    request_id: String,
    account: i64,
}

impl Bound {
    /// axum has no header binder, and its HeaderMap extractor is how a handler reads headers. A
    /// header that is missing or that does not convert is a 400.
    fn from(headers: &HeaderMap) -> Option<Bound> {
        let text = |name: &str| headers.get(name)?.to_str().ok();
        Some(Bound {
            tenant: text("x-rb-tenant")?.to_owned(),
            request_id: text("x-rb-request-id")?.to_owned(),
            account: text("x-rb-account")?.parse().ok()?,
        })
    }
}

/// headers: /headers reads no header, and /headers/bind reads three from the HeaderMap axum
/// extracts for it, the account as an integer.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/headers", get(move || async move { Json(&p.small) }))
        .route("/headers/bind", get(move |headers: HeaderMap| async move {
            Bound::from(&headers).map(|bound| Json(Echoed::new(&p.small, bound))).ok_or(StatusCode::BAD_REQUEST)
        }))
}
