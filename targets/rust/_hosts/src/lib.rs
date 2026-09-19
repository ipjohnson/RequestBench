//! What every Rust target needs from the host: the port to bind and what to answer on
//! /__meta.
//!
//! Only the container contract is implemented. That is Cloud Run's contract and therefore
//! covers Fargate, ECS and plain Docker unchanged; the function hosts have no first-party
//! Rust runtime worth measuring, and a hand-written shim would measure the shim.

use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

include!(concat!(env!("OUT_DIR"), "/built.rs"));

/// Where boot_ms counts from, taken by boot(), which is the first statement of every
/// target's main. Rust keeps no start time for its own process, so the process's start and
/// the async runtime the main macro builds before main's body runs are not counted.
static STARTED: OnceLock<Instant> = OnceLock::new();

/// How long the target took to listen, once it has.
static BOOT: OnceLock<Duration> = OnceLock::new();

/// The version the lockfile resolved for a dependency, or empty when it is not one.
pub fn crate_version(name: &str) -> &'static str {
    LOCK.iter().find(|(n, _)| *n == name).map(|(_, v)| *v).unwrap_or("")
}

/// What a target answers on /__meta. Outside the blend spec on purpose: it is not measured
/// and not conformance-checked, it exists so a point on the results chart can be
/// attributed to a framework version rather than to a different runner.
///
/// `adapter` is empty under the container contract, where the framework serves its own
/// requests. `serializer` is the JSON library the target writes and reads JSON with. Each
/// target passes its own, because a framework with a JSON facility is configured through it
/// and two targets need not agree on which library. `template` is the engine this target
/// renders the template family with. Each target passes its own, because each reaches an
/// engine through its own framework's view facility, and the one framework here with a view
/// layer does not share the others'.
///
/// `etag` and `cache` say the same thing about the two caching families: which digest
/// computed the validator, and what stored the response. Only salvo has either as a
/// framework facility, so only salvo passes its own; the rest take the defaults below,
/// which name what they hold instead.
pub fn meta(framework: &str, serializer: &str, template: &str) -> Value {
    meta_with(framework, serializer, template,
              "sha1 (the framework ships no conditional handling)", "a shared LRU")
}

pub fn meta_with(framework: &str, serializer: &str, template: &str, etag: &str, cache: &str)
    -> Value {
    let mut m = json!({
        "framework": framework,
        "version": crate_version(framework),
        "runtime": RUSTC,
        "adapter": "",
        "serializer": serializer,
        "template": template,
        "etag": etag,
        "cache": cache,
    });
    if let Some(d) = BOOT.get() {
        m["boot_ms"] = json!((d.as_secs_f64() * 10_000.0).round() / 10.0);
    }
    m
}

/// Called by a target once its framework is listening. Each of the six binds its own way,
/// so each calls this where its own bind has returned.
pub fn listening() {
    if let Some(started) = STARTED.get() {
        let _ = BOOT.set(started.elapsed());
    }
}

pub fn port() -> u16 {
    std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080)
}

/// Fixture first, then the port. A target that binds before it can answer is a target the
/// health probe lets through and the gate then fails for the wrong reason.
pub fn boot(framework: &str) -> u16 {
    STARTED.get_or_init(Instant::now);
    if let Err(e) = rb_domain::load(&rb_domain::fixture_path()) {
        eprintln!("fixture: {e}");
        std::process::exit(1);
    }
    let p = port();
    eprintln!("container/{framework} listening on {p}");
    p
}
