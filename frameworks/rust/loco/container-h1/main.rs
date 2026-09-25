use implementation::app::App;
use loco_rs::cli;

/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Loco's command line, as the main.rs Loco's starter generates runs it. The image runs `start`,
// which serves the application through Loco's own Hooks::serve: axum::serve on the binding and the
// port the config file names, stopped by SIGTERM.
// Two runtime workers under the container's two-CPU quota: tokio starts one per core that
// std::thread::available_parallelism reports, and that reads the cgroup's quota.
#[tokio::main]
async fn main() -> loco_rs::Result<()> {
    cli::main::<App>().await
}
