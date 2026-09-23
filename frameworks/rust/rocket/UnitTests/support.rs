use std::path::PathBuf;

use implementation::Payloads;
use rocket::http::{ContentType, Header};
use rocket::local::blocking::{Client, LocalResponse};
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

pub fn payloads() -> Payloads {
    Payloads::load(directory()).expect("the payloads load")
}

/// The application over the payloads, ignited, with cache stores of its own.
pub fn client() -> Client {
    Client::untracked(implementation::app(payloads())).expect("the application ignites")
}

/// A request with headers, which the handlers under test read.
pub fn get<'c>(client: &'c Client, path: &str, headers: &[(&str, &str)]) -> LocalResponse<'c> {
    let mut request = client.get(path.to_owned());
    for (name, value) in headers {
        request.add_header(Header::new(name.to_string(), value.to_string()));
    }
    request.dispatch()
}

/// A body sent with its type and its length, as a client sends it.
pub fn post<'c>(client: &'c Client, path: &str, content_type: &str, body: impl AsRef<[u8]>) -> LocalResponse<'c> {
    let body = body.as_ref();
    client
        .post(path.to_owned())
        .header(ContentType::parse_flexible(content_type).expect("a content type"))
        .header(Header::new("content-length", body.len().to_string()))
        .body(body)
        .dispatch()
}

pub fn bytes(response: LocalResponse<'_>) -> Vec<u8> {
    response.into_bytes().unwrap_or_default()
}

pub fn json(response: LocalResponse<'_>) -> Value {
    serde_json::from_slice(&bytes(response)).expect("the body is JSON")
}

pub fn text(response: LocalResponse<'_>) -> String {
    String::from_utf8(bytes(response)).expect("the body is text")
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

pub fn header(response: &LocalResponse<'_>, name: &str) -> Option<String> {
    response.headers().get_one(name).map(str::to_owned)
}

pub fn serial(response: &LocalResponse<'_>) -> u64 {
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
