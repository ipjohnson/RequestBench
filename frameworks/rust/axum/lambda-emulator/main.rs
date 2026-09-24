/// The allocator the binary runs on, as every Rust framework's server here runs on it.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// The function: the payloads loaded from RB_PAYLOADS, then the router behind lambda_http, whose
// runtime asks the Runtime API for each event and answers it through the router.
#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    lambda_http::run(implementation::app(payloads)).await
}
