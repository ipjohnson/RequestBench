use actix_web::{App, HttpServer};

/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// HttpServer starts one worker thread per core that std::thread::available_parallelism reports,
// which reads the cgroup's quota, so the container runs two workers under its two-CPU budget.
// actix-server stops gracefully on SIGTERM itself, so PID 1 needs no handler of its own here.
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);

    let routes = implementation::routes(payloads);
    // actix-web leaves TCP_NODELAY at the operating system's default, which is off, unless told.
    HttpServer::new(move || App::new().configure(routes.clone())).tcp_nodelay(true).bind(("0.0.0.0", port))?.run().await
}
