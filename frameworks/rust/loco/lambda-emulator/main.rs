use implementation::app::App;
use loco_rs::app::Hooks;
use loco_rs::boot::StartMode;
use loco_rs::environment::{Environment, resolve_from_env};

/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// The function: the application booted as Loco's start boots it, from the environment's config
// file, with its router then handed to lambda_http rather than served on a port. Loco has no Lambda
// adapter. lambda_http's runtime asks the Runtime API for each event and answers it through the
// router.
#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let environment: Environment = resolve_from_env().into();
    let config = App::load_config(&environment).await?;
    loco_rs::logger::init::<App>(&config.logger)?;
    let boot = App::boot(StartMode::ServerOnly, &environment, config).await?;
    let router = boot.router.expect("a server boot builds the router");
    lambda_http::run(router).await
}
