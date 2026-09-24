//! One request and its whole answer, for the gate and for priming. Nothing here is timed, so an
//! exchange waits on a connection of its own, taken from those an earlier exchange left open.
use std::cell::RefCell;
use std::time::Duration;

use base64::Engine;
use serde_json::{Value, json};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::http1::{Answer, Read, Reader};
use crate::request::{Request, http1};

pub struct Exchanger {
    host: String,
    port: u16,
    /// Connections an answer left open, newest last.
    idle: RefCell<Vec<TcpStream>>,
}

impl Exchanger {
    pub fn new(host: String, port: u16) -> Self {
        Exchanger { host, port, idle: RefCell::new(Vec::new()) }
    }

    pub fn authority(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    /// The answer as JSON for the pipe, or why there is none.
    pub async fn exchange(&self, request: &Request, timeout: Duration) -> Result<Value, String> {
        let describe = || format!("{} {}", request.method, request.target);
        match tokio::time::timeout(timeout, self.send(request)).await {
            Ok(result) => result.map_err(|why| format!("{}: {why}", describe())),
            Err(_) => Err(format!("{}: no answer within {} s", describe(), timeout.as_secs())),
        }
    }

    async fn send(&self, request: &Request) -> Result<Value, String> {
        let body = request.body()?;
        let authority = self.authority();
        let bytes = http1(request, body.as_deref(), &authority);
        // A framework can close an idle connection just as it is taken again. The request then
        // meets a closed connection and nothing of an answer arrives, so it goes once more on a
        // new one. An answer cut off after it began is the framework's, and is never retried.
        let (answer, stream) = match self.take().await? {
            (stream, true) => match self.once(stream, &bytes, request.is_head()).await {
                Err(Cut::Before(_)) => self.once(self.connect().await?, &bytes, request.is_head()).await,
                other => other,
            },
            (stream, false) => self.once(stream, &bytes, request.is_head()).await,
        }
        .map_err(Cut::why)?;
        if let Some(stream) = stream {
            self.idle.borrow_mut().push(stream);
        }
        let kept = answer.kept.unwrap_or_default();
        Ok(json!({
            "status": answer.status,
            "reason": kept.reason,
            "version": kept.version,
            "host": authority,
            "headers": kept.headers,
            "body": base64::engine::general_purpose::STANDARD.encode(&kept.body),
            "bodyBytes": answer.body_bytes,
        }))
    }

    /// The request on this connection, and the connection back when the answer left it open.
    async fn once(&self, mut stream: TcpStream, bytes: &[u8], head: bool) -> Result<(Answer, Option<TcpStream>), Cut> {
        stream.write_all(bytes).await.map_err(|e| Cut::Before(e.to_string()))?;
        let mut reader = Reader::new();
        reader.begin(head, true);
        let mut buf = vec![0u8; 64 * 1024];
        let mut arrived = 0;
        let cut = |arrived: usize, why: String| if arrived == 0 { Cut::Before(why) } else { Cut::After(why) };
        loop {
            stream.readable().await.map_err(|e| cut(arrived, e.to_string()))?;
            let read = match stream.try_read(&mut buf) {
                Ok(0) => reader.closed(),
                Ok(n) => {
                    arrived += n;
                    reader.feed(&buf[..n])
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => continue,
                Err(e) => return Err(cut(arrived, e.to_string())),
            };
            match read {
                Read::More => {}
                Read::Done(answer) => return Ok((answer, (!reader.ends()).then_some(stream))),
                Read::Failed(why) => return Err(cut(arrived, why)),
            }
        }
    }

    /// An idle connection the framework has not closed since, or a new one, and which it is.
    async fn take(&self) -> Result<(TcpStream, bool), String> {
        loop {
            let Some(stream) = self.idle.borrow_mut().pop() else { break };
            // An open connection with nothing to read would block, and one the framework closed
            // reads as ended.
            let mut probe = [0u8; 1];
            if let Err(e) = stream.try_read(&mut probe)
                && e.kind() == std::io::ErrorKind::WouldBlock
            {
                return Ok((stream, true));
            }
        }
        Ok((self.connect().await?, false))
    }

    async fn connect(&self) -> Result<TcpStream, String> {
        let stream = TcpStream::connect((self.host.as_str(), self.port)).await.map_err(|e| format!("connect: {e}"))?;
        stream.set_nodelay(true).map_err(|e| e.to_string())?;
        Ok(stream)
    }
}

/// Why an exchange has no answer, and whether any of one arrived first.
enum Cut {
    Before(String),
    After(String),
}

impl Cut {
    fn why(self) -> String {
        match self {
            Cut::Before(why) | Cut::After(why) => why,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::{Read as _, Write as _};
    use std::net::{Shutdown, TcpListener};

    use super::*;

    /// A server that answers one request on each connection and then closes it without saying so.
    fn one_a_connection() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { return };
                let mut seen = Vec::new();
                let mut chunk = [0u8; 1024];
                while !seen.windows(4).any(|w| w == b"\r\n\r\n") {
                    match stream.read(&mut chunk) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => seen.extend_from_slice(&chunk[..n]),
                    }
                }
                let _ = stream.write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}");
                let _ = stream.shutdown(Shutdown::Both);
            }
        });
        port
    }

    #[tokio::test]
    async fn a_request_that_meets_a_connection_the_framework_closed_goes_again_on_a_new_one() {
        let exchanger = Exchanger::new("127.0.0.1".into(), one_a_connection());
        let request = Request { method: "GET".into(), target: "/x".into(), headers: vec![], body: None };
        for _ in 0..3 {
            let answer = exchanger.exchange(&request, Duration::from_secs(5)).await.unwrap();
            assert_eq!(answer["status"], 200);
            assert_eq!(answer["bodyBytes"], 2);
        }
    }
}
