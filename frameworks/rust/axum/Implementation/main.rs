use axum::serve::ListenerExt;
use tokio::net::TcpListener;
use tokio::signal::unix::{SignalKind, signal};

/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Two runtime workers under the container's two-CPU quota: tokio starts one per core that
// std::thread::available_parallelism reports, and that reads the cgroup's quota.
#[tokio::main]
async fn main() {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);

    // axum leaves TCP_NODELAY at the operating system's default, which is off, and tap_io is where
    // its documentation turns it on.
    let listener = TcpListener::bind(("0.0.0.0", port)).await.expect("the port is free").tap_io(|tcp| {
        let _ = tcp.set_nodelay(true);
    });
    axum::serve(listener, implementation::app(payloads)).with_graceful_shutdown(terminated()).await.expect("the server runs");
}

/// Docker stops a container with SIGTERM, and the process is PID 1, which the kernel gives no
/// default action for it. Without a handler, docker stop waits out its timeout and kills it.
async fn terminated() {
    signal(SignalKind::terminate()).expect("SIGTERM can be handled").recv().await;
}
