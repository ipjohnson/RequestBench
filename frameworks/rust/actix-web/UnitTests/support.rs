use std::path::PathBuf;
use std::sync::OnceLock;

use actix_http::Request;
use actix_web::body::MessageBody;
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::header::{CONTENT_LENGTH, CONTENT_TYPE};
use actix_web::test::{self, TestRequest};
use actix_web::web::Bytes;
use actix_web::{App, Error};
use implementation::Payloads;
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

/// The application as actix-web's test utilities build it, a service the suite hands requests to.
pub struct TestApp<S>(S);

/// The application over the payloads, with cache stores of its own.
pub async fn app() -> TestApp<impl Service<Request, Response = ServiceResponse<impl MessageBody>, Error = Error>> {
    TestApp(test::init_service(App::new().configure(implementation::routes(payloads()))).await)
}

impl<S, B> TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<B>, Error = Error>,
    B: MessageBody,
{
    pub async fn send(&self, request: TestRequest) -> ServiceResponse<B> {
        test::call_service(&self.0, request.to_request()).await
    }

    pub async fn get(&self, path: &str) -> ServiceResponse<B> {
        self.send(TestRequest::get().uri(path)).await
    }

    /// A request with headers, which the routes under test read.
    pub async fn get_with(&self, path: &str, headers: &[(&str, &str)]) -> ServiceResponse<B> {
        let mut request = TestRequest::get().uri(path);
        for (name, value) in headers {
            request = request.insert_header((*name, *value));
        }
        self.send(request).await
    }

    /// A body sent with its type and its length, as a client sends it.
    pub async fn post(&self, path: &str, content_type: &str, body: impl Into<Bytes>) -> ServiceResponse<B> {
        self.with_body(TestRequest::post(), path, content_type, body).await
    }

    pub async fn with_body(&self, request: TestRequest, path: &str, content_type: &str, body: impl Into<Bytes>) -> ServiceResponse<B> {
        let body = body.into();
        let request = request.uri(path).insert_header((CONTENT_TYPE, content_type)).insert_header((CONTENT_LENGTH, body.len())).set_payload(body);
        self.send(request).await
    }
}

pub async fn bytes(response: ServiceResponse<impl MessageBody>) -> Bytes {
    test::read_body(response).await
}

pub async fn json(response: ServiceResponse<impl MessageBody>) -> Value {
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

pub fn header<'a, B>(response: &'a ServiceResponse<B>, name: &str) -> Option<&'a str> {
    response.headers().get(name).map(|value| value.to_str().expect("the header is text"))
}

pub fn serial<B>(response: &ServiceResponse<B>) -> u64 {
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
