// rb:test *
//! The target, driven through salvo's own TestClient, which sends a request to a Service in
//! process with no server and no socket. It is behind salvo's test feature, so the suite
//! declares salvo again as a dev-dependency with that feature on; it reaches no build but a
//! test's.
//!
//! The response can be read two ways. take_string, which salvo's testing documentation uses,
//! decodes gzip on the way out, so the floor would be handed a body the target never sent.
//! take_bytes hands back the bytes the handler wrote, and that is what this reads.
//!
//! It needed the target to change first. The router and the Service around it were built
//! inline in main(), so no test could build them; service() builds them now and main() serves
//! what it returns. main() is also where the fixture is loaded, through rb_host::boot, so the
//! suite loads it.
use super::floor::Answer;
use super::planned::{self, capture_for, resolved, Ask};
use salvo::http::header::HeaderName;
use salvo::test::{ResponseExt, TestClient};
use std::collections::BTreeMap;
use std::sync::Once;

pub const TARGET: &str = "rust:salvo";

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
    let url = format!("http://127.0.0.1{}", a.path);
    let mut req = match a.method.as_str() {
        "GET" => TestClient::get(&url),
        "POST" => TestClient::post(&url),
        "PUT" => TestClient::put(&url),
        "PATCH" => TestClient::patch(&url),
        "DELETE" => TestClient::delete(&url),
        m => panic!("no TestClient verb for {m}"),
    };
    if let Some(b) = &a.body {
        req = req.bytes(b.clone().into_bytes());
    }
    // After the body, because bytes() sets a content type of its own.
    for (k, v) in headers {
        req = req.add_header(HeaderName::from_bytes(k.as_bytes()).unwrap(), v.as_str(), true);
    }
    let mut r = req.send(&crate::service()).await;
    let status = r.status_code.map(|s| s.as_u16()).unwrap_or(200);
    let headers = r.headers().iter()
        .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string())).collect();
    let raw = r.take_bytes(None).await.unwrap_or_default().to_vec();
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
