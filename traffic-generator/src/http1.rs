//! The smallest HTTP/1.1 answer parser that can say where an answer ends: the status, the headers
//! that frame the body, and then the body by its length, by its chunks, or by the close. It reads
//! bytes and owns no socket, so the load and a single exchange share it.
//!
//! wire.ts did this in TypeScript. It kept an answer's headers and body only when asked, and so
//! does this.

pub const CLOSED: &str = "the connection closed before the answer ended";

#[derive(Debug)]
pub struct Answer {
    pub status: u16,
    /// The body with the chunk framing off and any content coding still on.
    pub body_bytes: u64,
    pub kept: Option<Kept>,
}

/// What an exchange hands back beyond the status: the answer as the framework wrote it.
#[derive(Debug, Default)]
pub struct Kept {
    pub version: String,
    pub reason: String,
    /// Names as the framework spelled them, in the order it wrote them.
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(Debug)]
pub enum Read {
    /// The answer has not ended.
    More,
    Done(Answer),
    Failed(String),
}

#[derive(PartialEq, Clone, Copy, Debug)]
enum Stage {
    Idle,
    Head,
    Fixed,
    Size,
    Chunk,
    Trailer,
    Eof,
}

pub struct Reader {
    stage: Stage,
    /// A head that has not arrived whole yet.
    pending: Vec<u8>,
    status: u16,
    /// Bytes still to read of the body, or of the chunk being read with its CRLF.
    left: u64,
    /// A chunk size or trailer line split across two reads.
    line: Vec<u8>,
    bytes: u64,
    head_request: bool,
    kept: Option<Kept>,
    /// The answer said the connection ends with it.
    ends: bool,
}

impl Default for Reader {
    fn default() -> Self {
        Self::new()
    }
}

impl Reader {
    pub fn new() -> Self {
        Reader {
            stage: Stage::Idle,
            pending: Vec::new(),
            status: 0,
            left: 0,
            line: Vec::new(),
            bytes: 0,
            head_request: false,
            kept: None,
            ends: false,
        }
    }

    /// Readies the reader for the answer to the request just sent.
    pub fn begin(&mut self, head_request: bool, keep: bool) {
        self.stage = Stage::Head;
        self.pending.clear();
        self.status = 0;
        self.left = 0;
        self.line.clear();
        self.bytes = 0;
        self.head_request = head_request;
        self.kept = keep.then(Kept::default);
        self.ends = false;
    }

    /// Whether the connection can carry another request after this answer.
    pub fn ends(&self) -> bool {
        self.ends
    }

    /// Bytes as they arrived. Anything after the end of the answer is not read, because only one
    /// request is ever in flight on a connection.
    pub fn feed(&mut self, chunk: &[u8]) -> Read {
        let joined;
        let buf: &[u8] = if self.pending.is_empty() {
            chunk
        } else {
            self.pending.extend_from_slice(chunk);
            joined = std::mem::take(&mut self.pending);
            &joined
        };
        let mut at = 0;
        if self.stage == Stage::Head {
            let Some(end) = find(buf, b"\r\n\r\n") else {
                self.pending = buf.to_vec();
                return Read::More;
            };
            at = end + 4;
            if let Some(read) = self.read_head(&buf[..end]) {
                return read;
            }
        }
        while at < buf.len() && self.stage != Stage::Idle {
            match self.stage {
                Stage::Fixed | Stage::Chunk | Stage::Eof => {
                    let rest = (buf.len() - at) as u64;
                    let take = if self.stage == Stage::Eof { rest } else { self.left.min(rest) };
                    // A chunk's own trailing CRLF is in `left` and is not body.
                    let body = if self.stage == Stage::Chunk { take.min(self.left.saturating_sub(2)) } else { take };
                    if body > 0
                        && let Some(kept) = &mut self.kept
                    {
                        kept.body.extend_from_slice(&buf[at..at + body as usize]);
                    }
                    self.bytes += body;
                    at += take as usize;
                    if self.stage == Stage::Eof {
                        continue;
                    }
                    self.left -= take;
                    if self.left == 0 {
                        if self.stage == Stage::Fixed {
                            return Read::Done(self.finish());
                        }
                        self.stage = Stage::Size;
                    }
                }
                Stage::Size | Stage::Trailer => {
                    let nl = buf[at..].iter().position(|&b| b == b'\n').map(|i| at + i);
                    let end = nl.map_or(buf.len(), |i| i + 1);
                    self.line.extend_from_slice(&buf[at..end]);
                    at = end;
                    if nl.is_none() {
                        continue;
                    }
                    let line = std::mem::take(&mut self.line);
                    if self.stage == Stage::Size {
                        match chunk_size(&line) {
                            None => {
                                let text = String::from_utf8_lossy(&line).trim().to_string();
                                return self.fail(format!("a chunk size the answer wrote as {text:?}"));
                            }
                            Some(0) => self.stage = Stage::Trailer,
                            Some(size) => {
                                self.left = size + 2;
                                self.stage = Stage::Chunk;
                            }
                        }
                    } else if line == b"\r\n" || line == b"\n" {
                        return Read::Done(self.finish());
                    }
                }
                Stage::Idle | Stage::Head => unreachable!(),
            }
        }
        Read::More
    }

    /// The peer closed the connection. A body framed by the close ends here, and anything else
    /// was cut off.
    pub fn closed(&mut self) -> Read {
        match self.stage {
            Stage::Eof => Read::Done(self.finish()),
            Stage::Idle => Read::More,
            _ => self.fail(CLOSED.to_string()),
        }
    }

    /// The status and how the body is framed. Some when the answer ended or failed with its head.
    fn read_head(&mut self, head: &[u8]) -> Option<Read> {
        let text: String = head.iter().map(|&b| b as char).collect();
        let status = text.get(9..12).and_then(|s| s.parse::<u16>().ok());
        let Some(status) = status.filter(|_| text.starts_with("HTTP/1.")) else {
            let start: String = text.chars().take(32).collect();
            return Some(self.fail(format!("an answer starting {start:?}")));
        };
        self.status = status;
        let mut lines = text.split("\r\n");
        let first = lines.next().unwrap_or_default();
        if let Some(kept) = &mut self.kept {
            kept.version = first.get(5..8).unwrap_or_default().to_string();
            kept.reason = first.get(13..).unwrap_or_default().to_string();
        }
        let mut length: Option<u64> = None;
        let mut chunked = false;
        for line in lines {
            let Some(colon) = line.find(':') else { continue };
            let name = line[..colon].to_ascii_lowercase();
            let value = line[colon + 1..].trim();
            if let Some(kept) = &mut self.kept {
                kept.headers.push((line[..colon].to_string(), value.to_string()));
            }
            match name.as_str() {
                "content-length" => length = value.parse().ok(),
                "transfer-encoding" => chunked |= value.to_ascii_lowercase().contains("chunked"),
                "connection" => self.ends |= value.to_ascii_lowercase().contains("close"),
                _ => {}
            }
        }
        // RFC 9112 6.3: an answer to HEAD, a 1xx, a 204 or a 304 ends at the blank line.
        if self.head_request || status == 204 || status == 304 || status < 200 {
            return Some(Read::Done(self.finish()));
        }
        if chunked {
            self.stage = Stage::Size;
        } else if let Some(length) = length {
            if length == 0 {
                return Some(Read::Done(self.finish()));
            }
            self.left = length;
            self.stage = Stage::Fixed;
        } else {
            // Nothing frames it, so it ends when the connection does.
            self.ends = true;
            self.stage = Stage::Eof;
        }
        None
    }

    fn finish(&mut self) -> Answer {
        self.stage = Stage::Idle;
        Answer { status: self.status, body_bytes: self.bytes, kept: self.kept.take() }
    }

    fn fail(&mut self, why: String) -> Read {
        self.stage = Stage::Idle;
        self.ends = true;
        Read::Failed(why)
    }
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// The hex digits a chunk-size line starts with, as parseInt read them: leading whitespace
/// skipped, and an extension or anything else after the digits ignored.
fn chunk_size(line: &[u8]) -> Option<u64> {
    let digits: Vec<u8> = line.iter().skip_while(|b| b.is_ascii_whitespace()).take_while(|b| b.is_ascii_hexdigit()).copied().collect();
    if digits.is_empty() {
        return None;
    }
    u64::from_str_radix(std::str::from_utf8(&digits).ok()?, 16).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read_all(head: bool, keep: bool, parts: &[&[u8]]) -> (Read, bool) {
        let mut r = Reader::new();
        r.begin(head, keep);
        for part in parts {
            match r.feed(part) {
                Read::More => {}
                other => return (other, r.ends()),
            }
        }
        (r.closed(), r.ends())
    }

    fn done(read: Read) -> Answer {
        match read {
            Read::Done(a) => a,
            other => panic!("expected an answer, got {other:?}"),
        }
    }

    #[test]
    fn a_body_by_length_ends_at_its_length_even_across_reads() {
        let (read, ends) = read_all(false, true, &[b"HTTP/1.1 200 OK\r\nContent-Len", b"gth: 5\r\n\r\nhel", b"lo"]);
        let a = done(read);
        assert_eq!((a.status, a.body_bytes, ends), (200, 5, false));
        let kept = a.kept.unwrap();
        assert_eq!(kept.body, b"hello");
        assert_eq!(kept.reason, "OK");
        assert_eq!(kept.version, "1.1");
        assert_eq!(kept.headers, vec![("Content-Length".to_string(), "5".to_string())]);
    }

    #[test]
    fn a_chunked_body_ends_after_its_trailer_however_it_is_split() {
        let answer = b"HTTP/1.1 200 OK\r\ntransfer-encoding: chunked\r\n\r\n3\r\nabc\r\n2;x=y\r\nde\r\n0\r\nx-trailer: 1\r\n\r\n";
        for split in 1..answer.len() {
            let (read, _) = read_all(false, true, &[&answer[..split], &answer[split..]]);
            let a = done(read);
            assert_eq!(a.body_bytes, 5, "split at {split}");
            assert_eq!(a.kept.unwrap().body, b"abcde");
        }
    }

    #[test]
    fn a_head_answer_and_a_304_end_at_their_headers() {
        let (read, ends) = read_all(true, false, &[b"HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\n\r\n"]);
        assert_eq!((done(read).body_bytes, ends), (0, false));
        let (read, _) = read_all(false, false, &[b"HTTP/1.1 304 Not Modified\r\netag: \"x\"\r\n\r\n"]);
        assert_eq!(done(read).status, 304);
    }

    #[test]
    fn a_body_nothing_frames_ends_with_the_connection() {
        let (read, ends) = read_all(false, false, &[b"HTTP/1.1 200 OK\r\n\r\nall", b" of it"]);
        let a = done(read);
        assert_eq!((a.body_bytes, ends), (9, true));
    }

    #[test]
    fn connection_close_ends_the_connection_and_a_cut_answer_fails() {
        let (read, ends) = read_all(false, false, &[b"HTTP/1.1 200 OK\r\nConnection: close\r\ncontent-length: 2\r\n\r\n{}"]);
        assert_eq!((done(read).status, ends), (200, true));
        let (read, _) = read_all(false, false, &[b"HTTP/1.1 200 OK\r\ncontent-length: 9\r\n\r\nshort"]);
        assert!(matches!(read, Read::Failed(why) if why == CLOSED));
    }

    #[test]
    fn an_answer_that_is_not_http_fails() {
        let (read, _) = read_all(false, false, &[b"SSH-2.0-OpenSSH\r\n\r\n"]);
        assert!(matches!(read, Read::Failed(why) if why.starts_with("an answer starting")));
        let (read, _) = read_all(false, false, &[b"HTTP/1.1 200 OK\r\ntransfer-encoding: chunked\r\n\r\nzz\r\n"]);
        assert!(matches!(read, Read::Failed(why) if why == "a chunk size the answer wrote as \"zz\""));
    }
}
