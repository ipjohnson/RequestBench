// rb:test *
//! The target, driven through tower's ServiceExt::oneshot, which is what axum's own testing
//! example uses. A request goes straight into the Router as a tower Service and the Response
//! comes back: no server, no socket, and nothing in between to decode it, so a gzip body is
//! still gzip when the floor reads it. axum already depends on tower, so this needs nothing
//! new.
//!
//! It needed the target to change first. The router was built inline in main(), so the only
//! way to reach it was to start this target on its container port; app() builds it now and
//! main() serves what it returns. main() is also where the fixture is loaded, through
//! rb_host::boot, so the suite loads it.
use super::floor::Answer;
use super::planned::{self, capture_for, resolved, Ask};
use axum::body::Body;
use axum::http::Request;
use std::collections::BTreeMap;
use std::sync::Once;
use tower::ServiceExt;

pub const TARGET: &str = "rust:axum";

fn loaded() {
    static LOAD: Once = Once::new();
    LOAD.call_once(|| rb_domain::load(&planned::fixture()).expect("fixture"));
}

/// Send one of an endpoint's planned requests.
pub async fn send(a: &Ask) -> Answer {
    send_with(a, &a.headers).await
}

pub async fn send_with(a: &Ask, headers: &BTreeMap<String, String>) -> Answer {
    loaded();
    let mut req = Request::builder().method(a.method.as_str()).uri(a.path.as_str());
    for (k, v) in headers {
        req = req.header(k, v);
    }
    let body = a.body.clone().map(Body::from).unwrap_or_else(Body::empty);
    let r = crate::app().oneshot(req.body(body).unwrap()).await.unwrap();
    let status = r.status().as_u16();
    let headers = r.headers().iter()
        .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string())).collect();
    let raw = axum::body::to_bytes(r.into_body(), usize::MAX).await.unwrap().to_vec();
    answer_from(status, headers, raw)
}

/// Ask for the validator first, then send the request that carries it.
pub async fn send_after_capture(a: &Ask) -> Answer {
    let (method, path, header) = capture_for(a);
    let first = send_with(&Ask { method, path, headers: BTreeMap::new(), body: None, ..planned::ask(&a.id) }, &BTreeMap::new()).await;
    send_with(a, &resolved(a, first.headers.get(&header).map(String::as_str).unwrap_or(""))).await
}

fn answer_from(status: u16, headers: BTreeMap<String, String>, raw: Vec<u8>) -> Answer {
    Answer {
        status,
        content_type: headers.get("content-type").cloned().unwrap_or_default(),
        encoding: headers.get("content-encoding").cloned().unwrap_or_default(),
        raw,
        headers,
    }
}
// rb:end
