// rb:test *
//! The target, driven through Rocket's blocking local Client, which is what Rocket's testing
//! guide reaches for first. Client::tracked ignites the application in process and dispatches
//! a request to it with no socket, and it is synchronous, so these are plain #[test]s with no
//! runtime of their own. The body is the bytes the handler wrote.
//!
//! It needed the target to change first. The Rocket was built and launched inline in main(),
//! so no test could build one; rocket() builds it now, and main() launches what it returns on
//! its port. A local client never binds, so a test builds it with any. main() is also where the
//! fixture is loaded, through rb_host::boot, so the suite loads it.
use super::floor::Answer;
use super::planned::{self, capture_for, resolved, Ask};
use rocket::http::{Header, Method};
use rocket::local::blocking::Client;
use std::collections::BTreeMap;
use std::str::FromStr;
use std::sync::Once;

pub const TARGET: &str = "rust:rocket";

fn loaded() {
    static LOAD: Once = Once::new();
    LOAD.call_once(|| rb_domain::load(&planned::fixture()).expect("fixture"));
}

/// Send one of an endpoint's planned requests.
pub fn send(a: &Ask) -> Answer {
    send_with(a, &a.headers)
}

pub fn send_with(a: &Ask, headers: &BTreeMap<String, String>) -> Answer {
    loaded();
    let client = Client::tracked(crate::rocket(0)).expect("a Rocket that ignites");
    let mut req = client.req(Method::from_str(&a.method).unwrap(), a.path.clone());
    for (k, v) in headers {
        req.add_header(Header::new(k.clone(), v.clone()));
    }
    if let Some(b) = &a.body {
        req.set_body(b.clone());
    }
    let r = req.dispatch();
    let status = r.status().code;
    let headers = r.headers().iter()
        .map(|h| (h.name().as_str().to_lowercase(), h.value().to_string())).collect();
    let raw = r.into_bytes().unwrap_or_default();
    answer_from(status, headers, raw)
}

/// Ask for the validator first, then send the request that carries it.
pub fn send_after_capture(a: &Ask) -> Answer {
    let (method, path, header) = capture_for(a);
    let first = send_with(&Ask { method, path, headers: BTreeMap::new(), body: None, ..planned::ask(&a.id) }, &BTreeMap::new());
    send_with(a, &resolved(a, first.headers.get(&header).map(String::as_str).unwrap_or("")))
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
