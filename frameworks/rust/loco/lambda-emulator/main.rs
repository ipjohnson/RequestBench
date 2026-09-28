use futures_util::TryFutureExt;
use futures_util::future::Either;
use implementation::app::App;
use lambda_http::lambda_runtime::{self, FunctionResponse};
use lambda_http::request::LambdaRequest;
use lambda_http::tower::ServiceExt;
use lambda_http::{Adapter, LambdaEvent, StreamAdapter, service_fn};
use loco_rs::app::Hooks;
use loco_rs::boot::StartMode;
use loco_rs::environment::{Environment, resolve_from_env};

/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// The function: the application booted as Loco's start boots it, from the environment's config
// file, with its router then handed to lambda_http rather than served on a port. Loco has no Lambda
// adapter. lambda_http's runtime asks the Runtime API for each event. The sse and stream routes
// answer through lambda_http's StreamAdapter, which streams the answer, and every other request
// through its Adapter, which answers it whole as lambda_http::run does. lambda_runtime sends each
// answer the way its FunctionResponse says.
#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let environment: Environment = resolve_from_env().into();
    let config = App::load_config(&environment).await?;
    loco_rs::logger::init::<App>(&config.logger)?;
    let boot = App::boot(StartMode::ServerOnly, &environment, config).await?;
    let router = boot.router.expect("a server boot builds the router");
    let buffered = Adapter::from(router.clone());
    let streamed = StreamAdapter::from(router);
    lambda_runtime::run(service_fn(move |event: LambdaEvent<LambdaRequest>| {
        if streams(&event.payload) {
            Either::Left(
                streamed
                    .clone()
                    .oneshot(event)
                    .map_ok(FunctionResponse::StreamingResponse),
            )
        } else {
            Either::Right(
                buffered
                    .clone()
                    .oneshot(event)
                    .map_ok(FunctionResponse::BufferedResponse),
            )
        }
    }))
    .await
}

/// Whether an event asks for an sse or stream route, whose answer goes out as a stream.
fn streams(request: &LambdaRequest) -> bool {
    match request {
        LambdaRequest::ApiGatewayV2(r) => r
            .raw_path
            .as_deref()
            .is_some_and(|p| p.starts_with("/sse/") || p.starts_with("/stream/")),
        _ => false,
    }
}
