// rb:test *
//! What every test asserts before it asserts anything of its own.
//!
//! A port of difference() in client/src/expectation.ts, in its order and with its rules. The
//! order is the point: a target answering the right values as text/plain is not answering
//! correctly, so the kind of body is checked before the body. A suite stricter than the client
//! fails a target the client passes, and a looser one passes a target `make test` rejects.
use super::planned::Ask;
use serde_json::Value;
use std::collections::BTreeMap;
use std::io::Read;

/// What came back: the status, the two headers the floor reads, the body as sent, the rest.
pub struct Answer {
    pub status: u16,
    pub content_type: String,
    pub encoding: String,
    pub raw: Vec<u8>,
    pub headers: BTreeMap<String, String>,
}

/// Assert the pinned answer, or fail naming the first thing that differs.
pub fn check(a: &Ask, got: &Answer) {
    if let Some(why) = difference(a.want.as_ref().expect("an error endpoint"), got) {
        panic!("{}: {why}", a.key);
    }
}

pub fn difference(want: &Value, got: &Answer) -> Option<String> {
    let status = want["status"].as_u64().unwrap() as u16;
    if got.status != status {
        return Some(format!("expected {status}, got {}", got.status));
    }
    // A null is a field spec/expected.json deliberately does not pin; its "unpinned" block
    // says which. compressed.gzip_small is the one this suite meets.
    let class = body_class(&got.content_type);
    if let Some(w) = want["body_class"].as_str() {
        if class != w {
            return Some(format!("expected a {w} body, got {class}"));
        }
    }
    if let Some(w) = want["encoding"].as_str() {
        if got.encoding != w {
            let named = |e: &str| if e.is_empty() { "identity".to_string() } else { e.to_string() };
            return Some(format!("expected content-encoding {}, got {}", named(w), named(&got.encoding)));
        }
    }
    first_difference(&comparable(&decoded(got), &got.content_type), &want["body"], "response")
}

pub fn body_class(content_type: &str) -> &'static str {
    let ctype = content_type.to_lowercase();
    if ctype.contains("json") { "json" }
    else if ctype.contains("html") { "html" }
    else if ctype.contains("text") { "text" }
    else if ctype.is_empty() { "none" }
    else { "other" }
}

/// gzip output differs between zlib, Java's Deflater and Go's compress/flate at the same
/// level. The decompressed bytes must not, so the comparison is taken over those. The
/// standard library has no gzip decoder, which is why this suite declares flate2.
fn decoded(got: &Answer) -> Vec<u8> {
    if got.raw.is_empty() || !got.encoding.contains("gzip") {
        return got.raw.clone();
    }
    let mut plain = Vec::new();
    match flate2::read::GzDecoder::new(&got.raw[..]).read_to_end(&mut plain) {
        Ok(_) => plain,
        Err(_) => got.raw.clone(),
    }
}

/// The response as a value rather than as bytes, so key order and 18928.0 stop mattering.
fn comparable(raw: &[u8], content_type: &str) -> Value {
    if raw.is_empty() {
        return Value::Null;
    }
    if content_type.contains("json") {
        return serde_json::from_slice(raw).unwrap_or(Value::String("unparseable-json".into()));
    }
    let mut text = String::from_utf8_lossy(raw).into_owned();
    if content_type.contains("html") {
        // Five template engines cannot agree on formatting, so the spec pins content and
        // leaves whitespace free: same elements, same order, same values.
        text = text.split(|c: char| " \t\n\r\x0c\x0b".contains(c)).filter(|s| !s.is_empty())
            .collect::<Vec<_>>().join(" ").replace("> ", ">").replace(" <", "<");
    }
    Value::String(text)
}

fn type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "NoneType",
        Value::Array(_) => "list",
        Value::Object(_) => "dict",
        Value::String(_) => "str",
        Value::Bool(_) => "bool",
        Value::Number(n) => if n.as_f64().is_some_and(|f| f.fract() == 0.0) { "int" } else { "float" },
    }
}

pub fn first_difference(a: &Value, b: &Value, path: &str) -> Option<String> {
    let (ta, tb) = (type_name(a), type_name(b));
    if ta != tb && !(a.is_number() && b.is_number()) {
        return Some(format!("{path}: {ta} vs {tb}"));
    }
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => {
            let keys: std::collections::BTreeSet<_> = x.keys().chain(y.keys()).collect();
            for k in keys {
                match (x.get(k), y.get(k)) {
                    (None, _) => return Some(format!("{path}.{k}: missing here, present in the reference")),
                    (_, None) => return Some(format!("{path}.{k}: present here, missing in the reference")),
                    (Some(xv), Some(yv)) => {
                        if let Some(d) = first_difference(xv, yv, &format!("{path}.{k}")) {
                            return Some(d);
                        }
                    }
                }
            }
            None
        }
        (Value::Array(x), Value::Array(y)) => {
            if x.len() != y.len() {
                return Some(format!("{path}: {} items vs {}", x.len(), y.len()));
            }
            x.iter().zip(y).enumerate()
                .find_map(|(i, (xv, yv))| first_difference(xv, yv, &format!("{path}[{i}]")))
        }
        (Value::Number(x), Value::Number(y)) =>
            (x.as_f64() != y.as_f64()).then(|| format!("{path}: {a} vs {b}")),
        _ => (a != b).then(|| format!("{path}: {a} vs {b}")),
    }
}
// rb:end
