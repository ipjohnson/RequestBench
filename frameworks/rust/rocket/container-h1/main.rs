/// The allocator the binary runs on. A server of this shape allocates on every request, and the
/// one glibc ships is the slower of the two under threads.
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Rocket builds its runtime with one worker per core num_cpus counts, and num_cpus reads the
// cgroup's quota, so the container runs two. Rocket stops gracefully on SIGTERM by default, and it
// sets TCP_NODELAY on every connection it accepts.
#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let dir = std::env::var("RB_PAYLOADS").expect("RB_PAYLOADS has to name the payload directory");
    let payloads = implementation::Payloads::load(&dir).unwrap_or_else(|e| panic!("the payloads in {dir} did not load: {e}"));
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);

    let app = implementation::app(payloads);
    let figment = app.figment().clone().merge(("address", "0.0.0.0")).merge(("port", port));
    app.configure(figment).launch().await?;
    Ok(())
}
