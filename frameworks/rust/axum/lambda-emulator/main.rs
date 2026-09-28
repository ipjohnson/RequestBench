/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

use futures_util::future::Either;
use futures_util::TryFutureExt;
use lambda_http::lambda_runtime::{self, FunctionResponse};
use lambda_http::request::LambdaRequest;
use lambda_http::tower::ServiceExt;
use lambda_http::{service_fn, Adapter, LambdaEvent, StreamAdapter};

// The function: the payloads loaded from RB_PAYLOADS, then the router behind lambda_http, whose
// runtime asks the Runtime API for each event. The sse and stream routes answer through
// lambda_http's StreamAdapter, which streams the answer, and every other request through its
// Adapter, which answers it whole as lambda_http::run does. lambda_runtime sends each answer the
// way its FunctionResponse says.
#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let app = implementation::app(payloads);
    let buffered = Adapter::from(app.clone());
    let streamed = StreamAdapter::from(app);
    lambda_runtime::run(service_fn(move |event: LambdaEvent<LambdaRequest>| {
        if streams(&event.payload) {
            Either::Left(streamed.clone().oneshot(event).map_ok(FunctionResponse::StreamingResponse))
        } else {
            Either::Right(buffered.clone().oneshot(event).map_ok(FunctionResponse::BufferedResponse))
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
