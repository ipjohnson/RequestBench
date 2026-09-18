// rb:test *
//! The target, driven through actix-web's own test module: init_service builds the App in
//! process and call_service hands it a request, with no server and no socket. It is what
//! actix-web's testing documentation does. The App is built the way the server builds one,
//! through App::configure and the same config(). read_body returns the bytes the app wrote,
//! so a gzip body is still gzip.
//!
//! It needed the target to change first. The routes were chained inline in the closure main()
//! hands HttpServer, so no test could build them; config() holds them now and main() configures
//! its App with it. main() is also where the fixture is loaded, through rb_host::boot, so the
//! suite loads it.
use super::floor::Answer;
use super::planned::{self, capture_for, resolved, Ask};
use actix_web::http::Method;
use actix_web::{test, App};
use std::collections::BTreeMap;
use std::sync::Once;

pub const TARGET: &str = "rust:actix-web";

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
    let app = test::init_service(App::new().configure(crate::config)).await;
    let mut req = test::TestRequest::default()
        .method(Method::from_bytes(a.method.as_bytes()).unwrap()).uri(&a.path);
    for (k, v) in headers {
        req = req.insert_header((k.as_str(), v.as_str()));
    }
    if let Some(b) = &a.body {
        req = req.set_payload(b.clone());
    }
    let r = test::call_service(&app, req.to_request()).await;
    let status = r.status().as_u16();
    let headers = r.headers().iter()
        .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string())).collect();
    let raw = test::read_body(r).await.to_vec();
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
