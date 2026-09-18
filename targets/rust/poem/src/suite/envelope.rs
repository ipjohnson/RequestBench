// rb:test authorized.*,body.*,errors.*
//! What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.
//!
//! A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
//! envelope is the framework's own contract, so what is held is the status, the kind of body,
//! and the shape this target recorded: the envelope with the values taken out.
//!
//! The framework-agnostic `errors` block is deliberately not what this reads. That block says
//! what the plan intends, and a framework may declare otherwise in the client-exception
//! package beside it, which the conformance client reads. A suite reads what this target
//! recorded instead.
use super::floor::{body_class, Answer};
use super::planned::{envelope, Ask};
use serde_json::Value;
use std::collections::BTreeSet;

pub fn check(a: &Ask, got: &Answer, target: &str) {
    let recorded = envelope(target, &a.key)
        .unwrap_or_else(|| panic!("{}: spec/expected.json records no envelope for {target}", a.key));
    let status = recorded["status"].as_u64().unwrap() as u16;
    assert!(got.status == status, "{}: expected {status}, got {}", a.key, got.status);
    let class = body_class(&got.content_type);
    assert!(class == recorded["body_class"], "{}: expected a {} body, got {class}", a.key, recorded["body_class"]);
    let body = if got.raw.is_empty() { Value::Null }
        else { serde_json::from_slice(&got.raw).unwrap_or(Value::String("unparseable-json".into())) };
    let have = shape_of(&body, "");
    let want: BTreeSet<String> = recorded["shape"].as_array().unwrap().iter()
        .map(|s| s.as_str().unwrap().to_string()).collect();
    assert!(have == want, "{}: the envelope shape moved: missing {:?}, added {:?}", a.key,
            want.difference(&have).collect::<Vec<_>>(), have.difference(&want).collect::<Vec<_>>());
}

/// A port of shape_of() in harness/expected.py, which is what wrote the recorded shapes.
pub fn shape_of(node: &Value, path: &str) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    match node {
        Value::Object(m) => {
            if m.is_empty() { out.insert(format!("{path}{{}}")); }
            for (k, v) in m {
                let p = if path.is_empty() { k.clone() } else { format!("{path}.{k}") };
                out.extend(shape_of(v, &p));
            }
        }
        Value::Array(xs) => {
            if xs.is_empty() { out.insert(format!("{path}[]")); }
            for v in xs { out.extend(shape_of(v, &format!("{path}[]"))); }
        }
        Value::Null => { out.insert(format!("{path}:null")); }
        Value::String(_) => { out.insert(format!("{path}:string")); }
        Value::Bool(_) => { out.insert(format!("{path}:bool")); }
        Value::Number(_) => { out.insert(format!("{path}:number")); }
    }
    out
}
// rb:end
