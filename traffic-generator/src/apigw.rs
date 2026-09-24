//! API Gateway payload format 2.0: the event a Function URL hands a function for one HTTP
//! request, and the proxy response the function answers with. A streamed answer is a JSON prelude,
//! eight NUL bytes, and then the body as written.
use base64::Engine;
use serde_json::{Map, Value, json};

use crate::request::{CARRIES_BODY, Request};

/// The Function URL the events arrive at, which a request's Host names.
pub const DOMAIN: &str = "rb.lambda-url.us-east-1.on.aws";

/// Content types whose body a Function URL passes as text. Any other body arrives in base64 with
/// isBase64Encoded set.
fn is_text(content_type: &str) -> bool {
    let t = content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    t.starts_with("text/")
        || t == "application/json"
        || t.ends_with("+json")
        || t == "application/xml"
        || t.ends_with("+xml")
        || t == "application/javascript"
}

fn percent_decoded(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("zz"), 16)
        {
            out.push(b);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Repeated names arrive comma-joined, as payload format 2.0 joins them.
fn join(map: &mut Map<String, Value>, name: String, value: String) {
    match map.get_mut(&name) {
        Some(Value::String(existing)) => {
            existing.push(',');
            existing.push_str(&value);
        }
        _ => {
            map.insert(name, Value::String(value));
        }
    }
}

/// The event for one request, as the bytes a /next answer carries.
pub fn event(request: &Request, body: Option<&[u8]>) -> Vec<u8> {
    let (raw_path, raw_query) = request.target.split_once('?').unwrap_or((request.target.as_str(), ""));
    let mut headers = Map::new();
    let mut cookies: Vec<Value> = Vec::new();
    headers.insert("host".into(), DOMAIN.into());
    let mut content_type = String::new();
    for (name, value) in &request.headers {
        let name = name.to_ascii_lowercase();
        if name == "cookie" {
            cookies.extend(value.split(';').map(str::trim).filter(|c| !c.is_empty()).map(|c| Value::String(c.to_string())));
            continue;
        }
        if name == "content-type" {
            content_type.clone_from(value);
        }
        join(&mut headers, name, value.clone());
    }
    match body {
        Some(b) => join(&mut headers, "content-length".into(), b.len().to_string()),
        None if CARRIES_BODY.contains(&request.method.as_str()) => join(&mut headers, "content-length".into(), "0".into()),
        None => {}
    }
    for (name, value) in [
        ("x-amzn-trace-id", "Root=1-66f1a2b3-0123456789abcdef01234567"),
        ("x-forwarded-for", "127.0.0.1"),
        ("x-forwarded-port", "443"),
        ("x-forwarded-proto", "https"),
    ] {
        headers.entry(name).or_insert_with(|| value.into());
    }
    let user_agent = headers.get("user-agent").and_then(Value::as_str).unwrap_or("").to_string();
    let mut event = json!({
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": raw_path,
        "rawQueryString": raw_query,
        "headers": headers,
        "requestContext": {
            "accountId": "000000000000",
            "apiId": "rb",
            "domainName": DOMAIN,
            "domainPrefix": "rb",
            "http": { "method": request.method, "path": raw_path, "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1", "userAgent": user_agent },
            "requestId": "c0ffee00-0000-4000-8000-000000000000",
            "routeKey": "$default",
            "stage": "$default",
            "time": "23/Sep/2026:12:00:00 +0000",
            "timeEpoch": 1_790_164_800_000u64,
        },
        "isBase64Encoded": false,
    });
    if !cookies.is_empty() {
        event["cookies"] = Value::Array(cookies);
    }
    if !raw_query.is_empty() {
        let mut query = Map::new();
        for pair in raw_query.split('&').filter(|p| !p.is_empty()) {
            let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
            join(&mut query, percent_decoded(name), percent_decoded(value));
        }
        event["queryStringParameters"] = Value::Object(query);
    }
    if let Some(b) = body {
        match std::str::from_utf8(b) {
            Ok(text) if is_text(&content_type) => event["body"] = text.into(),
            _ => {
                event["body"] = base64::engine::general_purpose::STANDARD.encode(b).into();
                event["isBase64Encoded"] = true.into();
            }
        }
    }
    serde_json::to_vec(&event).expect("an event is JSON")
}

/// An answer as a caller of the Function URL would have read it.
#[derive(Debug, PartialEq)]
pub struct Answered {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    /// How the function framed it: `proxy` for a proxy response with a text body, `proxy-base64`
    /// for one with isBase64Encoded, `stream` for a streamed answer, and `bare` for a payload that
    /// is not a proxy response and so is all body.
    pub framing: &'static str,
    /// Everything the function posted to `/response`.
    pub payload_bytes: usize,
}

fn text_of(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// The status, headers and cookies of a proxy response or a streamed answer's prelude. Payload
/// format 2.0 has no multiValueHeaders, and a Function URL ignores it, although some adapters write
/// every header there as well. A null is no header: Amazon.Lambda.AspNetCoreServer writes
/// `"Content-Type": null` for an answer with no content type.
fn head_of(map: &Map<String, Value>, headers: &mut Vec<(String, String)>) -> u16 {
    if let Some(Value::Object(h)) = map.get("headers") {
        headers.extend(h.iter().filter(|(_, value)| !value.is_null()).map(|(name, value)| (name.clone(), text_of(value))));
    }
    if let Some(Value::Array(cookies)) = map.get("cookies") {
        headers.extend(cookies.iter().filter(|c| !c.is_null()).map(|c| ("set-cookie".to_string(), text_of(c))));
    }
    map.get("statusCode").and_then(Value::as_u64).map_or(200, |s| s as u16)
}

/// A proxy response. A payload that is not an object with a statusCode is the body of a 200 in
/// JSON, as payload format 2.0 reads it.
pub fn answered(payload: &[u8]) -> Result<Answered, String> {
    let value: Value = serde_json::from_slice(payload).map_err(|e| format!("the function answered what is not JSON: {e}"))?;
    let bare = || Answered {
        status: 200,
        headers: vec![("content-type".into(), "application/json".into())],
        body: payload.to_vec(),
        framing: "bare",
        payload_bytes: payload.len(),
    };
    let Value::Object(map) = &value else { return Ok(bare()) };
    if !map.contains_key("statusCode") {
        return Ok(bare());
    }
    let mut headers = Vec::new();
    let status = head_of(map, &mut headers);
    let base64 = map.get("isBase64Encoded").and_then(Value::as_bool).unwrap_or(false);
    let body = match map.get("body") {
        None | Some(Value::Null) => Vec::new(),
        Some(Value::String(text)) if base64 => {
            base64::engine::general_purpose::STANDARD.decode(text).map_err(|e| format!("a base64 body that does not decode: {e}"))?
        }
        Some(Value::String(text)) => text.as_bytes().to_vec(),
        Some(other) => other.to_string().into_bytes(),
    };
    Ok(Answered { status, headers, body, framing: if base64 { "proxy-base64" } else { "proxy" }, payload_bytes: payload.len() })
}

/// A streamed answer: the prelude, eight NUL bytes and the body. One with no prelude is all body.
pub fn streamed(payload: &[u8]) -> Result<Answered, String> {
    const SEPARATOR: [u8; 8] = [0; 8];
    let Some(at) = payload.windows(8).position(|w| w == SEPARATOR) else {
        return Ok(Answered { status: 200, headers: Vec::new(), body: payload.to_vec(), framing: "stream", payload_bytes: payload.len() });
    };
    let prelude: Value = serde_json::from_slice(&payload[..at]).map_err(|e| format!("a streamed answer's prelude is not JSON: {e}"))?;
    let mut headers = Vec::new();
    let status = match &prelude {
        Value::Object(map) => head_of(map, &mut headers),
        _ => 200,
    };
    Ok(Answered { status, headers, body: payload[at + 8..].to_vec(), framing: "stream", payload_bytes: payload.len() })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, target: &str, headers: &[(&str, &str)]) -> Request {
        Request {
            method: method.into(),
            target: target.into(),
            headers: headers.iter().map(|(n, v)| (n.to_string(), v.to_string())).collect(),
            body: None,
        }
    }

    #[test]
    fn an_event_carries_the_path_the_query_the_headers_and_the_cookies_as_a_function_url_writes_them() {
        let r = request(
            "GET",
            "/query/many?q=alpha%20bravo&tag=a&tag=b",
            &[("x-rb-tenant", "t"), ("x-rb-tenant", "u"), ("cookie", "a=1; b=2")],
        );
        let event: Value = serde_json::from_slice(&event(&r, None)).unwrap();
        assert_eq!(event["rawPath"], "/query/many");
        assert_eq!(event["rawQueryString"], "q=alpha%20bravo&tag=a&tag=b");
        assert_eq!(event["queryStringParameters"]["q"], "alpha bravo");
        assert_eq!(event["queryStringParameters"]["tag"], "a,b");
        assert_eq!(event["headers"]["x-rb-tenant"], "t,u");
        assert_eq!(event["headers"]["host"], DOMAIN);
        assert_eq!(event["cookies"], json!(["a=1", "b=2"]));
        assert!(event["headers"].get("cookie").is_none());
        assert_eq!(event["requestContext"]["http"]["method"], "GET");
    }

    #[test]
    fn a_json_body_is_text_and_a_form_is_base64() {
        let json_post = request("POST", "/body", &[("content-type", "application/json")]);
        let e: Value = serde_json::from_slice(&event(&json_post, Some(br#"{"a":1}"#))).unwrap();
        assert_eq!((e["body"].as_str(), e["isBase64Encoded"].as_bool()), (Some(r#"{"a":1}"#), Some(false)));
        assert_eq!(e["headers"]["content-length"], "7");
        let form = request("POST", "/forms", &[("content-type", "multipart/form-data; boundary=x")]);
        let e: Value = serde_json::from_slice(&event(&form, Some(b"--x\r\n"))).unwrap();
        assert_eq!((e["body"].as_str(), e["isBase64Encoded"].as_bool()), (Some("LS14DQo="), Some(true)));
    }

    #[test]
    fn a_proxy_response_gives_its_status_headers_cookies_and_body() {
        let a = answered(br#"{"statusCode":201,"headers":{"content-type":"application/json","x-n":7},"cookies":["s=1"],"body":"eyJhIjoxfQ==","isBase64Encoded":true}"#).unwrap();
        assert_eq!((a.status, a.framing), (201, "proxy-base64"));
        assert_eq!(a.body, br#"{"a":1}"#);
        assert!(a.headers.contains(&("x-n".into(), "7".into())));
        assert!(a.headers.contains(&("set-cookie".into(), "s=1".into())));
        let bare = answered(br#"{"ok":true}"#).unwrap();
        assert_eq!((bare.status, bare.body.as_slice(), bare.framing), (200, br#"{"ok":true}"#.as_slice(), "bare"));
        let untyped = answered(br#"{"statusCode":204,"headers":{"Content-Type":null,"x-n":"1"}}"#).unwrap();
        assert_eq!(untyped.headers, vec![("x-n".to_string(), "1".to_string())]);
        let both = answered(br#"{"statusCode":200,"headers":{"x-n":"1"},"multiValueHeaders":{"x-n":["1"]}}"#).unwrap();
        assert_eq!(both.headers, vec![("x-n".to_string(), "1".to_string())]);
    }

    #[test]
    fn a_streamed_answer_is_its_prelude_then_its_body() {
        let mut wire = br#"{"statusCode":200,"headers":{"content-type":"text/event-stream"}}"#.to_vec();
        wire.extend_from_slice(&[0; 8]);
        wire.extend_from_slice(b"data: 1\n\n");
        let a = streamed(&wire).unwrap();
        assert_eq!((a.status, a.body.as_slice(), a.framing, a.payload_bytes), (200, b"data: 1\n\n".as_slice(), "stream", wire.len()));
        assert_eq!(a.headers, vec![("content-type".to_string(), "text/event-stream".to_string())]);
    }
}
