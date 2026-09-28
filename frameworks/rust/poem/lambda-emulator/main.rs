/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

use std::pin::Pin;
use std::sync::Arc;

use bytes::Bytes;
use futures_util::future::Either;
use futures_util::{Stream, TryFutureExt};
use lambda_http::http::header::SET_COOKIE;
use lambda_http::lambda_runtime::{self, FunctionResponse, MetadataPrelude, StreamResponse};
use lambda_http::request::LambdaRequest;
use lambda_http::tower::ServiceExt;
use lambda_http::{service_fn, Adapter, Body as LambdaBody, LambdaEvent, Request as LambdaHttpRequest, RequestExt};
use poem::{Body, Endpoint, EndpointExt, IntoEndpoint, Request};

/// A streamed answer's body, as poem hands it on.
type Rows = Pin<Box<dyn Stream<Item = Result<Bytes, std::io::Error>> + Send>>;

// The function: the payloads loaded from RB_PAYLOADS, then the Route behind lambda_http 0.15, whose
// runtime asks the Runtime API for each event. poem-lambda 5.1.4's run reads the whole of every
// answer, so this is a copy of it that leaves the sse and stream routes' answers a stream. Every
// other answer goes out whole, through lambda_http's Adapter as in poem-lambda's run, and those two
// go out as a StreamResponse. lambda_runtime sends each answer the way its FunctionResponse says.
#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let ep = Arc::new(implementation::app(payloads).map_to_response().into_endpoint());
    let whole = ep.clone();
    let buffered = service_fn(move |req: LambdaHttpRequest| {
        let ep = whole.clone();
        async move {
            let resp = ep.get_response(from_lambda_request(req)).await;
            let (parts, body) = resp.into_parts();
            let data = body.into_vec().await.map_err(|_| std::io::Error::other("invalid request"))?;
            let mut lambda_resp = poem::http::Response::new(if data.is_empty() {
                LambdaBody::Empty
            } else {
                match String::from_utf8(data) {
                    Ok(data) => LambdaBody::Text(data),
                    Err(err) => LambdaBody::Binary(err.into_bytes()),
                }
            });
            *lambda_resp.status_mut() = parts.status;
            *lambda_resp.version_mut() = parts.version;
            *lambda_resp.headers_mut() = parts.headers;
            *lambda_resp.extensions_mut() = parts.extensions;
            Ok::<_, lambda_http::Error>(lambda_resp)
        }
    });
    lambda_runtime::run(service_fn(move |event: LambdaEvent<LambdaRequest>| {
        if streams(&event.payload) {
            Either::Left(stream(ep.clone(), event).map_ok(FunctionResponse::StreamingResponse))
        } else {
            // lambda_http 0.15's Adapter is not Clone, and wraps the service at no cost.
            Either::Right(Adapter::from(buffered.clone()).oneshot(event).map_ok(FunctionResponse::BufferedResponse))
        }
    }))
    .await
}

/// Whether an event asks for an sse or stream route, whose answer goes out as a stream.
fn streams(request: &LambdaRequest) -> bool {
    match request {
        LambdaRequest::ApiGatewayV2(r) => r.raw_path.as_deref().is_some_and(|p| p.starts_with("/sse/") || p.starts_with("/stream/")),
        _ => false,
    }
}

/// An answer that goes out as it is written: its status, headers and cookies first, then poem's body
/// as it yields each part.
async fn stream<E: Endpoint>(ep: Arc<E>, event: LambdaEvent<LambdaRequest>) -> Result<StreamResponse<Rows>, lambda_http::Error> {
    let LambdaEvent { payload, context } = event;
    let request = LambdaHttpRequest::from(payload).with_lambda_context(context);
    let (parts, body) = ep.get_response(from_lambda_request(request)).await.into_parts();
    let mut headers = parts.headers;
    let cookies = headers.get_all(SET_COOKIE).iter().map(|c| String::from_utf8_lossy(c.as_bytes()).into_owned()).collect();
    headers.remove(SET_COOKIE);
    let rows: Rows = Box::pin(body.into_bytes_stream());
    Ok(StreamResponse { metadata_prelude: MetadataPrelude { headers, status_code: parts.status, cookies }, stream: rows })
}

/// poem-lambda's own conversion, which it keeps private.
fn from_lambda_request(req: LambdaHttpRequest) -> Request {
    let (parts, lambda_body) = req.into_parts();
    let body = match lambda_body {
        LambdaBody::Empty => Body::empty(),
        LambdaBody::Text(data) => Body::from_string(data),
        LambdaBody::Binary(data) => Body::from_vec(data),
    };
    let mut req = Request::builder().method(parts.method).uri(parts.uri).version(parts.version).body(body);
    *req.headers_mut() = parts.headers;
    *req.extensions_mut() = parts.extensions;
    req
}
