use std::collections::HashMap;
use std::future::poll_fn;
use std::net::{IpAddr, SocketAddr};
use std::pin::pin;

use actix_web::App;
use actix_web::body::{self, MessageBody};
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::Method;
use actix_web::http::header::SET_COOKIE;
use actix_web::test::{self, TestRequest};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use lambda_runtime::streaming::{self, Body};
use lambda_runtime::{Error, FunctionResponse, LambdaEvent, MetadataPrelude, StreamResponse, service_fn};
use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use serde::Deserialize;
use serde_json::{Map, Value, json};

/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// The function: the payloads loaded from RB_PAYLOADS, then the App behind lambda_runtime, whose
// runtime asks the Runtime API for each event. lambda-web 0.2.1's run_actix_on_lambda runs on
// lambda_runtime 0.7, which cannot stream, so this is a copy of it on lambda_runtime 1.4 that reads
// payload format 2.0 alone. It builds one App, where HttpServer builds one per worker. The sse and
// stream routes' answers go out as a stream, and every other answer goes out whole, as lambda-web's
// proxy response. lambda_runtime sends each answer the way its FunctionResponse says.
#[actix_web::main]
async fn main() -> Result<(), Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));

    let app = test::init_service(App::new().configure(implementation::routes(payloads))).await;
    lambda_runtime::run(service_fn(move |event: LambdaEvent<Event>| {
        let streams = streams(&event.payload);
        let call = request(event.payload).map(|request| app.call(request.to_request()));
        async move {
            let Ok(call) = call else {
                return Ok::<_, Error>(FunctionResponse::BufferedResponse(plain(400, "Bad Request")));
            };
            let Ok(response) = call.await else {
                return Ok(FunctionResponse::BufferedResponse(plain(500, "Internal Server Error")));
            };
            Ok(if streams { FunctionResponse::StreamingResponse(streamed(response)) } else { FunctionResponse::BufferedResponse(buffered(response).await) })
        }
    }))
    .await
}

/// A payload format 2.0 event, as far as lambda-web reads one.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Event {
    raw_path: String,
    raw_query_string: String,
    cookies: Option<Vec<String>>,
    headers: HashMap<String, String>,
    body: Option<String>,
    #[serde(default)]
    is_base64_encoded: bool,
    request_context: RequestContext,
}

#[derive(Deserialize)]
struct RequestContext {
    http: Http,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Http {
    method: String,
    source_ip: String,
}

/// Whether an event asks for an sse or stream route, whose answer goes out as a stream.
fn streams(event: &Event) -> bool {
    event.raw_path.starts_with("/sse/") || event.raw_path.starts_with("/stream/")
}

/// The characters lambda-web escapes in rawPath, which arrives percent-decoded.
const PATH: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'+')
    .add(b':')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'@')
    .add(b'[')
    .add(b'\\')
    .add(b']')
    .add(b'^')
    .add(b'`')
    .add(b'{')
    .add(b'|')
    .add(b'}');

/// The request lambda-web builds from an event with actix-web's TestRequest.
fn request(event: Event) -> Result<TestRequest, Error> {
    let method = Method::try_from(event.request_context.http.method.as_str())?;
    let path = utf8_percent_encode(&event.raw_path, PATH);
    let uri = if event.raw_query_string.is_empty() { path.to_string() } else { format!("{path}?{}", event.raw_query_string) };
    let mut request = TestRequest::with_uri(&uri).method(method);
    if let Ok(ip) = event.request_context.http.source_ip.parse::<IpAddr>() {
        request = request.peer_addr(SocketAddr::from((ip, 0)));
    }
    for (name, value) in &event.headers {
        request = request.insert_header((name.as_str(), value.as_str()));
    }
    if let Some(cookies) = &event.cookies {
        request = request.insert_header(("cookie", cookies.join("; ")));
    }
    let body = match event.body {
        Some(body) if event.is_base64_encoded => STANDARD.decode(body)?,
        Some(body) => body.into_bytes(),
        None => Vec::new(),
    };
    Ok(request.set_payload(body))
}

/// lambda-web's proxy response: one value of each header, the last the App wrote, Set-Cookie's
/// values in cookies, and the body in base64, text included.
async fn buffered(response: ServiceResponse) -> Value {
    let status = response.status().as_u16();
    let mut cookies = Vec::new();
    let mut headers = Map::new();
    for (name, value) in response.headers() {
        let Ok(value) = value.to_str() else { continue };
        if name == SET_COOKIE {
            cookies.push(value.to_string());
        } else {
            headers.insert(name.as_str().to_string(), json!(value));
        }
    }
    match body::to_bytes(response.into_body()).await {
        Ok(body) => json!({ "isBase64Encoded": true, "statusCode": status, "cookies": cookies, "headers": headers, "body": STANDARD.encode(body) }),
        Err(_) => plain(500, "Internal Server Error"),
    }
}

/// lambda-web's answer when an event is no request, or the App fails to answer it.
fn plain(status: u16, body: &str) -> Value {
    json!({ "isBase64Encoded": false, "statusCode": status, "headers": { "content-type": "text/plain" }, "body": body })
}

/// An answer that goes out as the App writes it: its status, headers and cookies first, then each
/// chunk of the body. actix-web's body is not Send, and lambda_runtime's stream has to be, so a
/// task on this thread reads the body into lambda_runtime's channel.
fn streamed(response: ServiceResponse) -> StreamResponse<Body> {
    let status_code = StatusCode::from_u16(response.status().as_u16()).expect("actix-web's status is a status code");
    let mut headers = HeaderMap::new();
    let mut cookies = Vec::new();
    for (name, value) in response.headers() {
        if name == SET_COOKIE {
            cookies.push(String::from_utf8_lossy(value.as_bytes()).into_owned());
        } else if let (Ok(name), Ok(value)) = (HeaderName::from_bytes(name.as_str().as_bytes()), HeaderValue::from_bytes(value.as_bytes())) {
            headers.append(name, value);
        }
    }
    let (mut sender, stream) = streaming::channel();
    let body = response.into_body();
    actix_web::rt::spawn(async move {
        let mut body = pin!(body);
        while let Some(chunk) = poll_fn(|cx| body.as_mut().poll_next(cx)).await {
            match chunk {
                Ok(chunk) => {
                    if sender.send_data(chunk).await.is_err() {
                        return;
                    }
                }
                Err(_) => {
                    sender.abort();
                    return;
                }
            }
        }
    });
    StreamResponse { metadata_prelude: MetadataPrelude { status_code, headers, cookies }, stream }
}
