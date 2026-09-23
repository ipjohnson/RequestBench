use std::path::PathBuf;
use std::sync::OnceLock;

use implementation::Payloads;
use poem::http::header::{CONTENT_LENGTH, CONTENT_TYPE};
use poem::http::Method;
use poem::test::TestClient;
use poem::{Response, Route};
use serde_json::Value;

/// The application behind poem's TestClient, which calls it in process with no server and no
/// socket.
pub type App = TestClient<Route>;

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

/// The application over the payloads, with cache stores of its own.
pub fn app() -> App {
    TestClient::new(implementation::app(payloads()))
}

/// A request with headers and, where there is one, a body sent with its type and its length, as a
/// client sends it.
pub async fn send(app: &App, method: Method, path: &str, headers: &[(&str, &str)], body: Option<(&str, Vec<u8>)>) -> Response {
    let mut request = app.request(method, path);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    if let Some((content_type, body)) = body {
        request = request.header(CONTENT_TYPE, content_type).header(CONTENT_LENGTH, body.len()).body(body);
    }
    request.send().await.0
}

pub async fn get(app: &App, path: &str) -> Response {
    send(app, Method::GET, path, &[], None).await
}

/// A request with headers, which the handlers under test read.
pub async fn get_with(app: &App, path: &str, headers: &[(&str, &str)]) -> Response {
    send(app, Method::GET, path, headers, None).await
}

pub async fn post(app: &App, path: &str, content_type: &str, body: impl Into<Vec<u8>>) -> Response {
    send(app, Method::POST, path, &[], Some((content_type, body.into()))).await
}

pub async fn bytes(response: Response) -> Vec<u8> {
    response.into_body().into_vec().await.expect("the body arrives")
}

pub async fn json(response: Response) -> Value {
    serde_json::from_slice(&bytes(response).await).expect("the body is JSON")
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

pub fn header<'a>(response: &'a Response, name: &str) -> Option<&'a str> {
    response.headers().get(name).map(|value| value.to_str().expect("the header is text"))
}

pub fn serial(response: &Response) -> u64 {
    header(response, "x-rb-serial").expect("the handler wrote x-rb-serial").parse().expect("x-rb-serial is a number")
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
