//! HTTP/2 with prior knowledge and no TLS, through the h2 crate, which hyper is built on. The
//! crate owns the framing, HPACK and flow control, and encodes each request's headers itself.
use std::future::poll_fn;

use bytes::Bytes;
use h2::client::{Builder, SendRequest};
use h2::{RecvStream, SendStream};
use http::header::CONTENT_LENGTH;
use http::{HeaderMap, HeaderName, HeaderValue, Method, Request as HttpRequest, Uri};
use tokio::net::TcpStream;

use crate::request::{CARRIES_BODY, Request};

/// Each stream's window and the connection's, as the client advertises them. The protocol's
/// 64 KiB would have the load's larger answers wait on window updates, which is the client's
/// setting and not the framework's cost, so they are set nearer what a browser sets.
const STREAM_WINDOW: u32 = 1 << 20;
const CONNECTION_WINDOW: u32 = 16 << 20;

/// A request built before anything is timed. Sending one clones its parts, because an HTTP
/// request is not reusable once the crate has taken it.
pub struct Template {
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Option<Bytes>,
}

impl Template {
    pub fn new(request: &Request, body: Option<Vec<u8>>, authority: &str) -> Result<Template, String> {
        let describe = || format!("{} {}", request.method, request.target);
        let method = Method::from_bytes(request.method.as_bytes()).map_err(|e| format!("{}: {e}", describe()))?;
        let uri: Uri = format!("http://{authority}{}", request.target).parse().map_err(|e| format!("{}: {e}", describe()))?;
        let mut headers = HeaderMap::new();
        for (name, value) in &request.headers {
            let name = HeaderName::from_bytes(name.as_bytes()).map_err(|e| format!("{}: {name}: {e}", describe()))?;
            let value = HeaderValue::from_str(value).map_err(|e| format!("{}: {value}: {e}", describe()))?;
            headers.append(name, value);
        }
        // The length a client knows, as HTTP/1.1 sends it, so a framework that reads it finds it.
        match &body {
            Some(b) => {
                headers.insert(CONTENT_LENGTH, HeaderValue::from(b.len()));
            }
            None if CARRIES_BODY.contains(&request.method.as_str()) => {
                headers.insert(CONTENT_LENGTH, HeaderValue::from(0));
            }
            None => {}
        }
        Ok(Template { method, uri, headers, body: body.map(Bytes::from) })
    }

    fn request(&self) -> HttpRequest<()> {
        let mut request = HttpRequest::new(());
        *request.method_mut() = self.method.clone();
        *request.uri_mut() = self.uri.clone();
        *request.headers_mut() = self.headers.clone();
        request
    }
}

/// A connection, and the task that drives its frames until it ends.
pub async fn connect(host: &str, port: u16) -> Result<(SendRequest<Bytes>, tokio::task::JoinHandle<()>), String> {
    let tcp = TcpStream::connect((host, port)).await.map_err(|e| format!("connect: {e}"))?;
    tcp.set_nodelay(true).map_err(|e| e.to_string())?;
    let (send, connection) = Builder::new()
        .initial_window_size(STREAM_WINDOW)
        .initial_connection_window_size(CONNECTION_WINDOW)
        .handshake::<_, Bytes>(tcp)
        .await
        .map_err(|e| format!("the HTTP/2 handshake: {e}"))?;
    let driver = tokio::task::spawn_local(async move {
        let _ = connection.await;
    });
    Ok((send, driver))
}

pub struct Answer {
    pub status: u16,
    pub body_bytes: u64,
    /// Kept only when asked for.
    pub headers: Option<HeaderMap>,
    pub body: Option<Vec<u8>>,
}

/// One request on the connection, and its whole answer.
pub async fn fetch(send: &SendRequest<Bytes>, template: &Template, keep: bool) -> Result<Answer, String> {
    let mut ready = send.clone().ready().await.map_err(|e| e.to_string())?;
    let (response, mut stream) = ready.send_request(template.request(), template.body.is_none()).map_err(|e| e.to_string())?;
    if let Some(body) = &template.body {
        send_body(&mut stream, body.clone()).await?;
    }
    let (parts, mut body) = response.await.map_err(|e| e.to_string())?.into_parts();
    let (body_bytes, kept) = read_body(&mut body, keep).await?;
    Ok(Answer { status: parts.status.as_u16(), body_bytes, headers: keep.then_some(parts.headers), body: kept })
}

async fn send_body(stream: &mut SendStream<Bytes>, mut body: Bytes) -> Result<(), String> {
    stream.reserve_capacity(body.len());
    while !body.is_empty() {
        let capacity =
            poll_fn(|cx| stream.poll_capacity(cx)).await.ok_or("the stream closed while the body was sent")?.map_err(|e| e.to_string())?;
        let chunk = body.split_to(capacity.min(body.len()));
        stream.send_data(chunk, body.is_empty()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// The body's length, and the body when kept. Each chunk's window is given back as it is read.
async fn read_body(body: &mut RecvStream, keep: bool) -> Result<(u64, Option<Vec<u8>>), String> {
    let mut bytes = 0u64;
    let mut kept = keep.then(Vec::new);
    while let Some(chunk) = body.data().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        bytes += chunk.len() as u64;
        let _ = body.flow_control().release_capacity(chunk.len());
        if let Some(kept) = &mut kept {
            kept.extend_from_slice(&chunk);
        }
    }
    Ok((bytes, kept))
}

#[cfg(test)]
pub mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use http::Response;
    use tokio::net::TcpListener;

    use super::*;

    /// An h2c server on its own thread that answers every request with its method, its path and
    /// the length of its body as JSON, and counts the connections it accepted.
    pub fn serve() -> (u16, Arc<AtomicUsize>) {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();
        let accepted = Arc::new(AtomicUsize::new(0));
        let counted = accepted.clone();
        std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            runtime.block_on(async move {
                let listener = TcpListener::from_std(listener).unwrap();
                loop {
                    let Ok((tcp, _)) = listener.accept().await else { return };
                    counted.fetch_add(1, Ordering::SeqCst);
                    tokio::spawn(async move {
                        let Ok(mut connection) = h2::server::handshake(tcp).await else { return };
                        while let Some(Ok((request, mut respond))) = connection.accept().await {
                            tokio::spawn(async move {
                                let (parts, mut body) = request.into_parts();
                                let (length, _) = read_body(&mut body, false).await.unwrap();
                                let text = format!(r#"{{"method":"{}","path":"{}","length":{length}}}"#, parts.method, parts.uri.path());
                                let head = Response::builder().status(200).header("content-type", "application/json").body(()).unwrap();
                                let head_only = parts.method == Method::HEAD;
                                let mut stream = respond.send_response(head, head_only).unwrap();
                                if !head_only {
                                    stream.send_data(Bytes::from(text), true).unwrap();
                                }
                            });
                        }
                    });
                }
            });
        });
        (port, accepted)
    }

    fn request(method: &str, body: Option<&str>) -> Request {
        use base64::Engine;
        Request {
            method: method.into(),
            target: "/echo?x=1".into(),
            headers: vec![("x-rb-tenant".into(), "t".into())],
            body: body.map(|b| base64::engine::general_purpose::STANDARD.encode(b)),
        }
    }

    #[tokio::test]
    async fn a_request_and_its_body_go_out_on_a_stream_and_the_whole_answer_comes_back() {
        let (port, _) = serve();
        tokio::task::LocalSet::new()
            .run_until(async move {
                let (send, _driver) = connect("127.0.0.1", port).await.unwrap();
                let post = request("POST", Some(r#"{"a":1}"#));
                let template = Template::new(&post, post.body().unwrap(), &format!("127.0.0.1:{port}")).unwrap();
                let answer = fetch(&send, &template, true).await.unwrap();
                assert_eq!(answer.status, 200);
                let body = String::from_utf8(answer.body.unwrap()).unwrap();
                assert_eq!(body, r#"{"method":"POST","path":"/echo","length":7}"#);
                assert_eq!(answer.body_bytes, body.len() as u64);
                assert_eq!(answer.headers.unwrap()["content-type"], "application/json");

                let head = request("HEAD", None);
                let template = Template::new(&head, None, "h").unwrap();
                let answer = fetch(&send, &template, false).await.unwrap();
                assert_eq!((answer.status, answer.body_bytes), (200, 0));
            })
            .await;
    }
}
