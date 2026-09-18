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
//!
//! A {run.<name>} placeholder is the exception. It stands for a value no target may know in
//! advance, so this draws its own once per test binary.
use serde_json::Value;
use std::collections::BTreeMap;
use std::hash::{BuildHasher, Hasher, RandomState};
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
    values: BTreeMap<String, Value>,
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
        let plan = read("plan.json");
        let values = draw(&plan["run_values"]);
        Spec { plan, values, expected: read("expected.json"), root }
    })
}

/// One value per declaration, held under the placeholder that stands for it: an int as a
/// number, anything else as a string.
fn draw(declared: &Value) -> BTreeMap<String, Value> {
    let text = |rule: &Value| -> String {
        let chars: Vec<char> = rule["chars"].as_str().unwrap().chars().collect();
        (0..rule["length"].as_u64().unwrap()).map(|_| chars[below(chars.len())]).collect()
    };
    let mut out = BTreeMap::new();
    for (name, rule) in declared.as_object().into_iter().flatten() {
        let value = match rule["kind"].as_str().unwrap() {
            "int" => {
                let low = 10usize.pow(rule["digits"].as_u64().unwrap() as u32 - 1);
                Value::from(low + below(9 * low))
            }
            "string" => Value::from(text(rule)),
            "words" => {
                let words: Vec<String> = (0..rule["count"].as_u64().unwrap()).map(|_| text(rule)).collect();
                Value::from(words.join(" "))
            }
            "choice" => {
                let values = rule["values"].as_array().unwrap();
                values[below(values.len())].clone()
            }
            kind => panic!("spec/plan.json declares {name} as {kind}, which is no kind this draws"),
        };
        out.insert(format!("{{run.{name}}}"), value);
    }
    out
}

/// A number below `n`. The standard library has no random number generator. A new RandomState
/// starts from random keys, so hashing nothing with it gives a random u64.
fn below(n: usize) -> usize {
    (RandomState::new().build_hasher().finish() % n as u64) as usize
}

pub fn fixture() -> String {
    spec().root.join("spec").join("fixture.json").to_string_lossy().into_owned()
}

pub fn ask(id: &str) -> Ask {
    let ep = spec().plan["endpoints"].as_array().unwrap().iter()
        .find(|e| e["id"] == id).unwrap_or_else(|| panic!("spec/plan.json has no endpoint {id}"));
    let path = ep["paths"][0].as_str().unwrap();
    let mut headers = BTreeMap::new();
    for source in [&ep["headers"], &ep["header_variants"][0]] {
        // A vary row sends a different header set per instance, which is what the response
        // cache is keyed on. Instance zero, for the reason above.
        if let Some(h) = source.as_object() {
            for (k, v) in h {
                headers.insert(k.clone(), in_header(v.as_str().unwrap()));
            }
        }
    }
    let body = ep["body"].as_str().map(str::to_string);
    if body.is_some() {
        headers.insert("content-type".into(), "application/json".into());
    }
    // Keyed by the path as the plan writes it, with any {run.<name>} still in it, because the
    // path that is sent changes every run.
    let key = format!("{id} {path}");
    let path = in_path(path);
    let expected = &spec().expected;
    let mut want = if expected["errors"].get(id).is_some() { None } else { expected["requests"].get(&key).cloned() };
    if let Some(pinned) = want.as_mut().and_then(|w| w.get_mut("body")) {
        fill(pinned);
    }
    Ask { id: id.into(), key, method: ep["method"].as_str().unwrap().into(), path, headers, body, want }
}

/// A path with every value in it, percent-encoded. Only RFC 3986's unreserved characters go as
/// they are. A space goes as %20 and never as +, because RFC 3986 does not read + as a space.
fn in_path(path: &str) -> String {
    let encoded = |v: &Value| -> String {
        sent(v).bytes().map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        }).collect()
    };
    spec().values.iter().fold(path.to_string(), |p, (placeholder, v)| p.replace(placeholder, &encoded(v)))
}

/// A header value with every value in it, as it is.
fn in_header(value: &str) -> String {
    spec().values.iter().fold(value.to_string(), |h, (placeholder, v)| h.replace(placeholder, &sent(v)))
}

/// A value as a request carries it: an int as its digits, a string as it is.
fn sent(v: &Value) -> String {
    v.as_str().map_or_else(|| v.to_string(), str::to_string)
}

/// Puts every value into a pinned body. spec/expected.json holds each as its placeholder,
/// always a string, and an int goes back in as the number it is.
fn fill(body: &mut Value) {
    match body {
        Value::String(s) => {
            if let Some(v) = spec().values.get(s.as_str()) {
                *body = v.clone();
            }
        }
        Value::Array(xs) => xs.iter_mut().for_each(fill),
        Value::Object(m) => m.values_mut().for_each(fill),
        _ => {}
    }
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
