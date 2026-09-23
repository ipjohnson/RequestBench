use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::OnceLock;

use bytes::Bytes;
use implementation::Payloads;
use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use warp::filters::BoxedFilter;
use warp::http::Response;
use warp::test::RequestBuilder;
use warp::{Filter, Reply};

/// tests/payloads: where RB_PAYLOADS names it, as `rb suite` does, or else found by walking up from
/// this package to the repository.
pub fn directory() -> PathBuf {
    if let Some(dir) = std::env::var_os("RB_PAYLOADS") {
        return PathBuf::from(dir);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .map(|dir| dir.join("tests").join("payloads"))
        .find(|dir| dir.join("items.large.json").is_file())
        .expect("tests/payloads is above this package")
}

pub fn payloads() -> &'static Payloads {
    static LOADED: OnceLock<&'static Payloads> = OnceLock::new();
    LOADED.get_or_init(|| Payloads::load(directory()).expect("the payloads load"))
}

/// The application as one filter, whatever it answers with.
pub type App = BoxedFilter<(warp::reply::Response,)>;

/// The application over the payloads, with cache stores of its own.
pub fn app() -> App {
    implementation::app(payloads()).map(Reply::into_response).boxed()
}

pub async fn send(app: &App, request: RequestBuilder) -> Response<Bytes> {
    request.reply(app).await
}

pub async fn get(app: &App, path: &str) -> Response<Bytes> {
    send(app, warp::test::request().method("GET").path(path)).await
}

/// A request with headers, which the filters under test read.
pub async fn get_with(app: &App, path: &str, headers: &[(&str, &str)]) -> Response<Bytes> {
    let mut request = warp::test::request().method("GET").path(path);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    send(app, request).await
}

/// A body sent with its type and its length, as a client sends it.
pub async fn post(app: &App, path: &str, content_type: &str, body: impl AsRef<[u8]>) -> Response<Bytes> {
    send(app, warp::test::request().method("POST").path(path).header("content-type", content_type).body(body)).await
}

pub fn json(response: &Response<Bytes>) -> Value {
    serde_json::from_slice(response.body()).expect("the body is JSON")
}

pub fn file(name: &str) -> Vec<u8> {
    std::fs::read(directory().join(name)).expect("the payload file is committed")
}

/// A committed payload, parsed.
pub fn expected(name: &str) -> Value {
    serde_json::from_slice(&file(name)).expect("the payload file is JSON")
}

/// A payload with an echo object beside its own fields, as a binding handler answers.
pub fn with_echo(name: &str, echo: Value) -> Value {
    let mut payload = expected(name);
    payload["echo"] = echo;
    payload
}

pub fn header<'a>(response: &'a Response<Bytes>, name: &str) -> Option<&'a str> {
    response.headers().get(name).map(|value| value.to_str().expect("the header is text"))
}

pub fn serial(response: &Response<Bytes>) -> u64 {
    header(response, "x-rb-serial").expect("the handler wrote x-rb-serial").parse().expect("x-rb-serial is a number")
}

/// The application served by warp on a port of its own, for what hyper writes on the wire rather
/// than what the filters answer.
pub async fn served() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("a port is free");
    let address = listener.local_addr().expect("the listener has an address");
    tokio::spawn(warp::serve(implementation::app(payloads())).incoming(listener).run());
    address
}

/// Everything the server writes back for one request, read until it closes the connection.
pub async fn raw(address: SocketAddr, request: &str) -> String {
    let mut stream = TcpStream::connect(address).await.expect("the server accepts");
    stream.write_all(request.as_bytes()).await.expect("the request is written");
    let mut answer = Vec::new();
    stream.read_to_end(&mut answer).await.expect("the answer is read");
    String::from_utf8(answer).expect("the answer is text")
}

/// The page the template rows render, as tests/payloads/index.ts writes it.
pub fn page(name: &str) -> String {
    let payload = expected(name);
    let rows: String = payload["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|it| {
            let stock = if it["inStock"].as_bool().unwrap() { "yes" } else { "no" };
            format!(
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{stock}</td></tr>",
                it["id"], it["name"].as_str().unwrap(), it["category"].as_str().unwrap(), it["priceCents"]
            )
        })
        .collect();
    format!(
        "<!doctype html><html><head><title>items</title></head><body><h1>{}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead><tbody>{rows}</tbody></table><p>{} rows</p></body></html>",
        payload["size"].as_str().unwrap(),
        payload["count"]
    )
}

/// Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a
/// page.
pub fn normal(html: &str) -> String {
    let collapsed = html.split(|c: char| " \t\n\r\x0c\x0b".contains(c)).filter(|run| !run.is_empty()).collect::<Vec<_>>().join(" ");
    collapsed.replace("> ", ">").replace(" <", "<")
}
