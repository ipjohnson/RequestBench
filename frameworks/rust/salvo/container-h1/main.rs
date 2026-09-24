use salvo::conn::tcp::TcpAcceptor;
use salvo::prelude::*;
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

    let server = Server::new(listen(port));
    let handle = server.handle();
    // Docker stops a container with SIGTERM, and the process is PID 1, which the kernel gives no
    // default action for it. Salvo installs no handler, so this one follows Salvo's graceful-shutdown
    // example. Without it, docker stop waits out its timeout and kills the server.
    tokio::spawn(async move {
        signal(SignalKind::terminate()).expect("SIGTERM can be handled").recv().await;
        handle.stop_graceful(None);
    });
    server.serve(implementation::service(payloads)).await;
}

/// Salvo's TcpListener leaves TCP_NODELAY at the operating system's default, which is off, and has
/// no setting for it, so the small writes of a streamed answer can wait on Nagle's algorithm. Linux
/// copies the option from a listening socket to each connection it accepts, so the socket is built
/// with tokio's TcpSocket, which can set it, and handed to Salvo as its acceptor.
fn listen(port: u16) -> TcpAcceptor {
    let socket = TcpSocket::new_v4().expect("a socket opens");
    socket.set_reuseaddr(true).expect("SO_REUSEADDR can be set");
    socket.set_nodelay(true).expect("TCP_NODELAY can be set");
    socket.bind(([0, 0, 0, 0], port).into()).expect("the port is free");
    let listener = socket.listen(1024).expect("the socket listens");
    TcpAcceptor::try_from(listener).expect("Salvo accepts on the listener")
}
