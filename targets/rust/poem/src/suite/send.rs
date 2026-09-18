// rb:test *
//! The target, driven through poem's own TestClient, which calls the endpoint in process with
//! no server and no socket. It is behind poem's test feature, so the suite declares poem again
//! as a dev-dependency with that feature on; it reaches no build but a test's. TestResponse
//! holds the Response the endpoint returned, so a gzip body is still gzip.
//!
//! It needed the target to change first. The routes, and the closures they are built from,
//! were inline in main(), so no test could build them; app() builds them now and main() runs
//! what it returns. main() is also where the fixture is loaded, through rb_host::boot, so the
//! suite loads it.
use super::floor::Answer;
use super::planned::{self, capture_for, resolved, Ask};
use poem::http::Method;
use poem::test::TestClient;
use std::collections::BTreeMap;
use std::sync::Once;

pub const TARGET: &str = "rust:poem";

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
    let cli = TestClient::new(crate::app());
    let mut req = cli.request(Method::from_bytes(a.method.as_bytes()).unwrap(), a.path.clone());
    for (k, v) in headers {
        req = req.header(k.as_str(), v.as_str());
    }
    if let Some(b) = &a.body {
        req = req.body(b.clone());
    }
    let r = req.send().await.0;
    let status = r.status().as_u16();
    let headers = r.headers().iter()
        .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string())).collect();
    let raw = r.into_body().into_vec().await.unwrap_or_default();
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
