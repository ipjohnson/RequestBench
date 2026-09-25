use implementation::app::App;
use loco_rs::cli;

/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Loco's command line, as container-h1 runs it. This binary is built with axum's http2 feature,
// so the axum::serve in Loco's own Hooks::serve answers a connection that opens with the HTTP/2
// preface in HTTP/2, and any other in HTTP/1.1.
// Two runtime workers under the container's two-CPU quota: tokio starts one per core that
// std::thread::available_parallelism reports, and that reads the cgroup's quota.
#[tokio::main]
async fn main() -> loco_rs::Result<()> {
    cli::main::<App>().await
}
