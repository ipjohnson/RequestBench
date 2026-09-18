// rb:test *
//! What a correct answer is, and which request asks for it.
//!
//! Both come out of spec/. spec/expected.json is the only authority on a correct answer and
//! the conformance client is the only thing that judges a target against it, so a suite that
//! passes while `make test` fails this target is the suite that is wrong, and writing a status
//! or a body into a test as a literal is how the two drift apart. spec/plan.json is where an
//! order id, a query string and a request body come from.
//!
//! Instance zero, always. An endpoint sends up to 512 requests and the conformance client
//! replays every one; a suite sends one, so it has to be the same one on every run or a
//! failure would not reproduce.
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::OnceLock;

/// One of an endpoint's requests, and the answer pinned for it. `want` is None for an error
/// endpoint: its envelope is the framework's own contract, and envelope.rs judges it.
pub struct Ask {
    pub id: String,
    pub key: String,
    pub method: String,
    pub path: String,
    pub headers: BTreeMap<String, String>,
    pub body: Option<String>,
    pub want: Option<Value>,
}

struct Spec {
    root: PathBuf,
    plan: Value,
    expected: Value,
}

fn spec() -> &'static Spec {
    static SPEC: OnceLock<Spec> = OnceLock::new();
    SPEC.get_or_init(|| {
        // cargo test runs from the crate, and the root is where spec/ is.
        let mut root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        while !root.join("spec").join("expected.json").exists() {
            root = root.parent().expect("no spec/expected.json above the crate").to_path_buf();
        }
        let read = |name: &str| -> Value {
            serde_json::from_slice(&std::fs::read(root.join("spec").join(name)).unwrap()).unwrap()
        };
        Spec { plan: read("plan.json"), expected: read("expected.json"), root }
    })
}

pub fn fixture() -> String {
    spec().root.join("spec").join("fixture.json").to_string_lossy().into_owned()
}

pub fn ask(id: &str) -> Ask {
    let ep = spec().plan["endpoints"].as_array().unwrap().iter()
        .find(|e| e["id"] == id).unwrap_or_else(|| panic!("spec/plan.json has no endpoint {id}"));
    let path = ep["paths"][0].as_str().unwrap().to_string();
    let mut headers = BTreeMap::new();
    for source in [&ep["headers"], &ep["header_variants"][0]] {
        // A vary row sends a different header set per instance, which is what the response
        // cache is keyed on. Instance zero, for the reason above.
        if let Some(h) = source.as_object() {
            for (k, v) in h {
                headers.insert(k.clone(), v.as_str().unwrap().to_string());
            }
        }
    }
    let body = ep["body"].as_str().map(str::to_string);
    if body.is_some() {
        headers.insert("content-type".into(), "application/json".into());
    }
    let key = format!("{id} {path}");
    let expected = &spec().expected;
    let want = if expected["errors"].get(id).is_some() { None } else { expected["requests"].get(&key).cloned() };
    Ask { id: id.into(), key, method: ep["method"].as_str().unwrap().into(), path, headers, body, want }
}

/// The request a validator is taken from, as method, path and header, for the one endpoint
/// that needs one first: etag.match_large carries {capture.etag_large}, which only the target
/// can produce.
pub fn capture_for(a: &Ask) -> (String, String, String) {
    let value = a.headers.values().find(|v| v.starts_with("{capture."))
        .unwrap_or_else(|| panic!("{} captures nothing", a.id));
    let c = &spec().plan["captures"][&value[9..value.len() - 1]];
    let s = |k: &str| c[k].as_str().unwrap().to_string();
    (s("method"), s("path"), s("header"))
}

/// The same headers with the capture's placeholder replaced by what was captured.
pub fn resolved(a: &Ask, captured: &str) -> BTreeMap<String, String> {
    a.headers.iter()
        .map(|(k, v)| (k.clone(), if v.starts_with("{capture.") { captured.to_string() } else { v.clone() }))
        .collect()
}

/// The error envelope this target recorded, as status, body class and shape.
pub fn envelope(target: &str, key: &str) -> Option<&'static Value> {
    spec().expected["targets"].get(target).and_then(|t| t.get(key))
}
// rb:end
