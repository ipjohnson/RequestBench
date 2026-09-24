use poem::Server;
use poem::http::uri::Scheme;
use poem::listener::{Acceptor, Listener, TcpAcceptor, TcpListener};
use poem::web::{LocalAddr, RemoteAddr};
use tokio::net::TcpStream;
use tokio::signal::unix::{SignalKind, signal};

/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Two runtime workers under the container's two-CPU quota: tokio starts one per core that
// std::thread::available_parallelism reports, and that reads the cgroup's quota.
#[tokio::main]
async fn main() -> std::io::Result<()> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);

    let acceptor = NoDelay(TcpListener::bind(("0.0.0.0", port)).into_acceptor().await?);
    Server::new_with_acceptor(acceptor).run_with_graceful_shutdown(implementation::app(payloads), terminated(), None).await
}

/// poem's TCP acceptor leaves TCP_NODELAY at the operating system's default, which is off, and has
/// no setting for it. An Acceptor of its own turns it on for each connection it accepts.
struct NoDelay(TcpAcceptor);

impl Acceptor for NoDelay {
    type Io = TcpStream;

    fn local_addr(&self) -> Vec<LocalAddr> {
        self.0.local_addr()
    }

    async fn accept(&mut self) -> std::io::Result<(TcpStream, LocalAddr, RemoteAddr, Scheme)> {
        let accepted = self.0.accept().await?;
        let _ = accepted.0.set_nodelay(true);
        Ok(accepted)
    }
}

/// Docker stops a container with SIGTERM, and the process is PID 1, which the kernel gives no
/// default action for it. poem's Server stops only when told to, so without this docker stop
/// waits out its timeout and kills it.
async fn terminated() {
    signal(SignalKind::terminate()).expect("SIGTERM can be handled").recv().await;
}
