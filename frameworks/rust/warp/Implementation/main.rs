use std::net::SocketAddr;

use tokio::net::TcpSocket;
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

    // warp sets no socket option on a connection it accepts, and the acceptor it takes is sealed,
    // so TCP_NODELAY goes on the listening socket, which Linux copies onto every connection
    // accepted from it. Otherwise the socket is the one warp's own bind makes: SO_REUSEADDR and a
    // backlog of 128.
    let socket = TcpSocket::new_v4().expect("a socket opens");
    socket.set_reuseaddr(true).expect("SO_REUSEADDR can be set");
    socket.set_nodelay(true).expect("TCP_NODELAY can be set");
    socket.bind(SocketAddr::from(([0, 0, 0, 0], port))).expect("the port is free");
    let listener = socket.listen(128).expect("the socket listens");

    warp::serve(implementation::app(payloads)).incoming(listener).graceful(terminated()).run().await;
}

/// Docker stops a container with SIGTERM, and the process is PID 1, which the kernel gives no
/// default action for it. Without a handler, docker stop waits out its timeout and kills it.
async fn terminated() {
    signal(SignalKind::terminate()).expect("SIGTERM can be handled").recv().await;
}
