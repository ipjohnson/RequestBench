//! A request as the corpus sends it, before any protocol. prepare.ts writes it, and each host
//! translates it into its own wire form.
use base64::Engine;
use serde::Deserialize;

#[derive(Deserialize, Clone, Debug)]
pub struct Request {
    pub method: String,
    /// The path with its query string, percent-encoded.
    pub target: String,
    /// In the order the test set them. The host adds its own and the framing.
    pub headers: Vec<(String, String)>,
    /// In base64. Absent when the request carries no body.
    #[serde(default)]
    pub body: Option<String>,
}

impl Request {
    pub fn body(&self) -> Result<Option<Vec<u8>>, String> {
        match &self.body {
            None => Ok(None),
            Some(b64) => base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map(Some)
                .map_err(|e| format!("{} {}: the body is not base64: {e}", self.method, self.target)),
        }
    }

    pub fn is_head(&self) -> bool {
        self.method == "HEAD"
    }
}

/// What the program speaks to the framework.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Protocol {
    Http1,
    /// HTTP/2 with prior knowledge and no TLS.
    H2c,
}

impl Protocol {
    pub fn parse(name: &str) -> Option<Protocol> {
        match name {
            "http/1.1" => Some(Protocol::Http1),
            "h2c" => Some(Protocol::H2c),
            _ => None,
        }
    }
}

/// Methods whose request says how long its body is even when it has none, so a framework that
/// reads a length finds one.
pub const CARRIES_BODY: [&str; 3] = ["POST", "PUT", "PATCH"];

/// The request as HTTP/1.1 bytes: the request line, the Host the connection was made to, the
/// test's headers, the length of the body, and keep-alive.
pub fn http1(request: &Request, body: Option<&[u8]>, authority: &str) -> Vec<u8> {
    let mut head = format!("{} {} HTTP/1.1\r\nhost: {authority}\r\n", request.method, request.target);
    for (name, value) in &request.headers {
        head.push_str(name);
        head.push_str(": ");
        head.push_str(value);
        head.push_str("\r\n");
    }
    match body {
        Some(b) => head.push_str(&format!("content-length: {}\r\n", b.len())),
        None if CARRIES_BODY.contains(&request.method.as_str()) => head.push_str("content-length: 0\r\n"),
        None => {}
    }
    head.push_str("connection: keep-alive\r\n\r\n");
    let mut bytes = head.into_bytes();
    if let Some(b) = body {
        bytes.extend_from_slice(b);
    }
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, headers: &[(&str, &str)]) -> Request {
        Request {
            method: method.into(),
            target: "/x?a=1".into(),
            headers: headers.iter().map(|(n, v)| (n.to_string(), v.to_string())).collect(),
            body: None,
        }
    }

    #[test]
    fn a_request_goes_out_as_prepare_ts_wrote_it() {
        let get = request("GET", &[("x-rb-tenant", "t")]);
        assert_eq!(
            String::from_utf8(http1(&get, None, "127.0.0.1:8080")).unwrap(),
            "GET /x?a=1 HTTP/1.1\r\nhost: 127.0.0.1:8080\r\nx-rb-tenant: t\r\nconnection: keep-alive\r\n\r\n"
        );
        let post = request("POST", &[("content-type", "application/json")]);
        assert_eq!(
            String::from_utf8(http1(&post, Some(b"{}"), "h:1")).unwrap(),
            "POST /x?a=1 HTTP/1.1\r\nhost: h:1\r\ncontent-type: application/json\r\ncontent-length: 2\r\nconnection: keep-alive\r\n\r\n{}"
        );
        let empty = request("PUT", &[]);
        assert!(String::from_utf8(http1(&empty, None, "h:1")).unwrap().contains("content-length: 0\r\n"));
    }
}
