use std::io::Read;
use std::path::PathBuf;

use axum::http::header::CONTENT_LENGTH;
use loco_rs::TestServer;
use serde_json::Value;

/// tests/payloads, as config/test.yaml names it: where RB_PAYLOADS does, as `rb suite` sets it, or
/// else above this package.
pub fn directory() -> PathBuf {
    std::env::var_os("RB_PAYLOADS").map_or_else(|| PathBuf::from("../../../tests/payloads"), PathBuf::from)
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

pub fn settings() -> Value {
    expected("settings.json")
}

/// A JSON body posted with its type and its length, as a client sends it.
pub async fn post_json(server: &TestServer, path: &str, body: Vec<u8>) -> axum_test::TestResponse {
    server.post(path).content_type("application/json").add_header(CONTENT_LENGTH, body.len()).bytes(body.into()).await
}

pub fn serial(response: &axum_test::TestResponse) -> u64 {
    response.header("x-rb-serial").to_str().expect("x-rb-serial is text").parse().expect("x-rb-serial is a number")
}

pub fn gunzip(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    flate2::read::GzDecoder::new(bytes).read_to_end(&mut out).expect("the body is gzip");
    out
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
