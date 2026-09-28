use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::pin::Pin;
use std::str::FromStr;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use lambda_runtime::{Error, FunctionResponse, LambdaEvent, MetadataPrelude, StreamResponse, service_fn};
use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use rocket::http::{Cookie, Header, Method};
use rocket::local::asynchronous::{Client, LocalRequest, LocalResponse};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use tokio_util::io::ReaderStream;

/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// A streamed answer's body, read from Rocket's answer as it is written.
type Rows = ReaderStream<LocalResponse<'static>>;

// The function: the payloads loaded from RB_PAYLOADS, then the application behind lambda_runtime,
// whose runtime asks the Runtime API for each event. lambda-web 0.2.1's launch_rocket_on_lambda runs
// on lambda_runtime 0.7, which cannot stream, so this is a copy of it on lambda_runtime 1.4 that
// reads payload format 2.0 alone. It dispatches each event to Rocket through Rocket's local client.
// The sse and stream routes' answers go out as a stream, and every other answer goes out whole, as
// lambda-web's proxy response. lambda_runtime sends each answer the way its FunctionResponse says.
#[rocket::main]
async fn main() -> Result<(), Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));

    // A streamed answer is still read after the handler returns, and it borrows the client, so the
    // client lives as long as the function.
    let client: &'static Client = Box::leak(Box::new(Client::untracked(implementation::app(payloads)).await?));
    // rocket::main runs a future that has to be Send. rustc checks that with the lifetimes in the
    // future's types erased, and then cannot show that the runtime's answers are FunctionResponses,
    // so the runtime's future is boxed as Send here, where its types are whole.
    let run: Pin<Box<dyn Future<Output = Result<(), Error>> + Send>> =
        Box::pin(lambda_runtime::run(service_fn(move |event: LambdaEvent<Event>| answer(client, event.payload))));
    run.await
}

async fn answer(client: &'static Client, event: Event) -> Result<FunctionResponse<Value, Rows>, Error> {
    let streams = streams(&event);
    let Ok(request) = request(client, event) else {
        return Ok(FunctionResponse::BufferedResponse(plain(400, "Bad Request")));
    };
    let response = request.dispatch().await;
    Ok(if streams { FunctionResponse::StreamingResponse(streamed(response)) } else { FunctionResponse::BufferedResponse(buffered(response).await) })
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

/// The request lambda-web dispatches for an event. It owns its path and its body, so neither the
/// request nor its answer borrows the event.
fn request(client: &'static Client, event: Event) -> Result<LocalRequest<'static>, Error> {
    let method = Method::from_str(&event.request_context.http.method).map_err(|_| "InvalidMethod")?;
    let ip = event.request_context.http.source_ip.parse().unwrap_or(IpAddr::from([0, 0, 0, 0]));
    let path = utf8_percent_encode(&event.raw_path, PATH);
    let uri = if event.raw_query_string.is_empty() { path.to_string() } else { format!("{path}?{}", event.raw_query_string) };
    let body = match event.body {
        Some(body) if event.is_base64_encoded => STANDARD.decode(body)?,
        Some(body) => body.into_bytes(),
        None => Vec::new(),
    };
    let mut request = client.req(method, uri).remote(SocketAddr::from((ip, 0))).body(body);
    for cookie in event.cookies.iter().flatten() {
        if let Ok(cookie) = Cookie::parse_encoded(cookie.as_str()) {
            request = request.cookie(cookie);
        }
    }
    for (name, value) in event.headers {
        request = request.header(Header::new(name, value));
    }
    if let Some(cookies) = event.cookies {
        request = request.header(Header::new("cookie", cookies.join("; ")));
    }
    Ok(request)
}

/// lambda-web's proxy response: one value of each header, the last Rocket wrote, named as Rocket
/// spells it, Set-Cookie's values in cookies, and the body in base64, text included.
async fn buffered(response: LocalResponse<'_>) -> Value {
    let status = response.status().code;
    let mut cookies = Vec::new();
    let mut headers = Map::new();
    for header in response.headers().iter() {
        if header.name == "set-cookie" {
            cookies.push(header.value.into_owned());
        } else {
            headers.insert(header.name.into_string(), json!(header.value));
        }
    }
    let body = response.into_bytes().await.unwrap_or_default();
    json!({ "isBase64Encoded": true, "statusCode": status, "cookies": cookies, "headers": headers, "body": STANDARD.encode(body) })
}

/// lambda-web's answer when an event is no request.
fn plain(status: u16, body: &str) -> Value {
    json!({ "isBase64Encoded": false, "statusCode": status, "headers": { "content-type": "text/plain" }, "body": body })
}

/// An answer that goes out as Rocket writes it: its status, headers and cookies first, then its
/// body as each read of it returns.
fn streamed(response: LocalResponse<'static>) -> StreamResponse<Rows> {
    let status_code = StatusCode::from_u16(response.status().code).expect("Rocket's status is a status code");
    let mut headers = HeaderMap::new();
    let mut cookies = Vec::new();
    for header in response.headers().iter() {
        if header.name == "set-cookie" {
            cookies.push(header.value.into_owned());
        } else if let (Ok(name), Ok(value)) = (HeaderName::from_bytes(header.name.as_str().as_bytes()), HeaderValue::from_str(&header.value)) {
            headers.append(name, value);
        }
    }
    StreamResponse { metadata_prelude: MetadataPrelude { status_code, headers, cookies }, stream: ReaderStream::new(response) }
}
