use std::path::PathBuf;
use std::sync::OnceLock;

use implementation::Payloads;
use salvo::http::header::{CONTENT_LENGTH, CONTENT_TYPE, HeaderName};
use salvo::prelude::*;
use salvo::test::{RequestBuilder, ResponseExt, TestClient};
use serde_json::Value;

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

/// The service over the payloads, with cache stores of its own.
pub fn service() -> Service {
    implementation::service(payloads())
}

/// TestClient takes an absolute URL, and the service reads only its path and query.
pub fn url(path: &str) -> String {
    format!("http://127.0.0.1{path}")
}

pub async fn send(service: &Service, request: RequestBuilder) -> Response {
    request.send(service).await
}

pub async fn get(service: &Service, path: &str) -> Response {
    send(service, TestClient::get(url(path))).await
}

/// A request with headers, which the handlers under test read.
pub async fn get_with(service: &Service, path: &str, headers: &[(&str, &str)]) -> Response {
    send(service, with_headers(TestClient::get(url(path)), headers)).await
}

pub fn with_headers(mut request: RequestBuilder, headers: &[(&str, &str)]) -> RequestBuilder {
    for (name, value) in headers {
        request = request.add_header(HeaderName::from_bytes(name.as_bytes()).expect("a header name"), *value, true);
    }
    request
}

/// A body sent with its type and its length, as a client sends it.
pub fn with_body(request: RequestBuilder, content_type: &str, body: impl Into<Vec<u8>>) -> RequestBuilder {
    let body = body.into();
    request.add_header(CONTENT_TYPE, content_type, true).add_header(CONTENT_LENGTH, body.len(), true).body(body)
}

pub async fn post(service: &Service, path: &str, content_type: &str, body: impl Into<Vec<u8>>) -> Response {
    send(service, with_body(TestClient::post(url(path)), content_type, body)).await
}

pub fn status(response: &Response) -> StatusCode {
    response.status_code.expect("the service writes a status")
}

/// The bytes the service wrote, before anything decodes them.
pub async fn bytes(mut response: Response) -> Vec<u8> {
    response.take_bytes(None).await.expect("the body arrives").to_vec()
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
