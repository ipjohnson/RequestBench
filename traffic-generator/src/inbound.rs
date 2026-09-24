//! The requests a Lambda runtime client sends the Runtime API, read off its connection. A body is
//! framed by its length or by chunks, and Go's client sends every one chunked, with trailers.

use std::time::Instant;

/// One whole request.
#[derive(Debug)]
pub struct Inbound {
    pub method: String,
    pub path: String,
    /// Names in lower case, as they arrived.
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    /// When the first bytes of its head were read.
    pub started: Instant,
}

impl Inbound {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.iter().find(|(n, _)| n == name).map(|(_, v)| v.as_str())
    }
}

#[derive(Default)]
pub struct RequestReader {
    buf: Vec<u8>,
    /// When the bytes at the front of `buf` began to arrive.
    started: Option<Instant>,
}

impl RequestReader {
    /// The requests these bytes complete, in order.
    pub fn feed(&mut self, chunk: &[u8], now: Instant) -> Result<Vec<Inbound>, String> {
        if self.buf.is_empty() {
            self.started = Some(now);
        }
        self.buf.extend_from_slice(chunk);
        let mut out = Vec::new();
        while let Some((inbound, used)) = take(&self.buf, self.started.unwrap_or(now))? {
            out.push(inbound);
            self.buf.drain(..used);
            // A second request already in the buffer began arriving with this read.
            self.started = Some(now);
        }
        Ok(out)
    }
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// One request off the front of `buf` and the bytes it took, or None until it has all arrived.
fn take(buf: &[u8], started: Instant) -> Result<Option<(Inbound, usize)>, String> {
    let Some(end) = find(buf, b"\r\n\r\n") else { return Ok(None) };
    let head = String::from_utf8_lossy(&buf[..end]);
    let mut lines = head.split("\r\n");
    let line = lines.next().unwrap_or_default();
    let mut parts = line.split(' ');
    let (Some(method), Some(path)) = (parts.next(), parts.next()) else {
        return Err(format!("a request line {line:?}"));
    };
    let mut headers = Vec::new();
    let mut length = 0usize;
    let mut chunked = false;
    for line in lines {
        let Some(colon) = line.find(':') else { continue };
        let name = line[..colon].trim().to_ascii_lowercase();
        let value = line[colon + 1..].trim().to_string();
        match name.as_str() {
            "content-length" => length = value.parse().map_err(|_| format!("a content-length of {value:?}"))?,
            "transfer-encoding" => chunked |= value.to_ascii_lowercase().contains("chunked"),
            _ => {}
        }
        headers.push((name, value));
    }
    let mut at = end + 4;
    let mut body = Vec::new();
    if chunked {
        loop {
            let Some(eol) = find(&buf[at..], b"\r\n") else { return Ok(None) };
            let size_line = String::from_utf8_lossy(&buf[at..at + eol]);
            let digits: String = size_line.trim().chars().take_while(char::is_ascii_hexdigit).collect();
            let size = usize::from_str_radix(&digits, 16).map_err(|_| format!("a chunk size of {size_line:?}"))?;
            at += eol + 2;
            if size == 0 {
                // Trailers, then the blank line that ends the request.
                loop {
                    let Some(eol) = find(&buf[at..], b"\r\n") else { return Ok(None) };
                    at += eol + 2;
                    if eol == 0 {
                        break;
                    }
                }
                break;
            }
            if buf.len() < at + size + 2 {
                return Ok(None);
            }
            body.extend_from_slice(&buf[at..at + size]);
            at += size + 2;
        }
    } else {
        if buf.len() < at + length {
            return Ok(None);
        }
        body.extend_from_slice(&buf[at..at + length]);
        at += length;
    }
    Ok(Some((Inbound { method: method.to_string(), path: path.to_string(), headers, body, started }, at)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_body_by_length_and_a_chunked_body_with_trailers_arrive_whole_however_they_are_split() {
        let by_length = b"POST /2018-06-01/runtime/invocation/x/response HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}".to_vec();
        let chunked = b"POST /r HTTP/1.1\r\nTransfer-Encoding: chunked\r\nTrailer: Lambda-Runtime-Function-Error-Type\r\n\r\n3\r\nabc\r\n1\r\nd\r\n0\r\nLambda-Runtime-Function-Error-Type: x\r\n\r\n".to_vec();
        for wire in [by_length, chunked] {
            for split in 1..wire.len() {
                let mut r = RequestReader::default();
                let now = Instant::now();
                let mut got = r.feed(&wire[..split], now).unwrap();
                got.extend(r.feed(&wire[split..], now).unwrap());
                assert_eq!(got.len(), 1, "split at {split}");
                assert!(got[0].body == b"{}" || got[0].body == b"abcd");
            }
        }
    }

    #[test]
    fn two_requests_in_one_read_are_two_requests() {
        let mut r = RequestReader::default();
        let two = b"GET /2018-06-01/runtime/invocation/next HTTP/1.1\r\n\r\nGET /a HTTP/1.1\r\nHost: h\r\n\r\n";
        let got = r.feed(two, Instant::now()).unwrap();
        assert_eq!(got.iter().map(|i| i.path.as_str()).collect::<Vec<_>>(), ["/2018-06-01/runtime/invocation/next", "/a"]);
        assert_eq!(got[1].header("host"), Some("h"));
    }
}
