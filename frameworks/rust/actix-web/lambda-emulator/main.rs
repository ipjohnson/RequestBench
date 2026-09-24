use actix_web::App;

/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// The function: the payloads loaded from RB_PAYLOADS, then the App behind lambda-web, whose
// runtime asks the Runtime API for each event and answers it through the App. lambda-web builds
// one App, where HttpServer builds one per worker.
#[actix_web::main]
async fn main() -> Result<(), lambda_web::LambdaError> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));

    let routes = implementation::routes(payloads);
    lambda_web::run_actix_on_lambda(move || App::new().configure(routes.clone())).await
}
