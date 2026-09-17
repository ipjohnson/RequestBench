//! What every Rust target needs from the host: the port to bind and what to answer on
//! /__meta.
//!
//! Only the container contract is implemented. That is Cloud Run's contract and therefore
//! covers Fargate, ECS and plain Docker unchanged; the function hosts have no first-party
//! Rust runtime worth measuring, and a hand-written shim would measure the shim.

use serde_json::{json, Value};

include!(concat!(env!("OUT_DIR"), "/built.rs"));

/// The version the lockfile resolved for a dependency, or empty when it is not one.
pub fn crate_version(name: &str) -> &'static str {
    LOCK.iter().find(|(n, _)| *n == name).map(|(_, v)| *v).unwrap_or("")
}

/// What a target answers on /__meta. Outside the blend spec on purpose: it is not measured
/// and not conformance-checked, it exists so a point on the results chart can be
/// attributed to a framework version rather than to a different runner.
///
/// `adapter` is empty under the container contract, where the framework serves its own
/// requests. `template` is the engine this target renders the template family with. Each
/// target passes its own, because each reaches an engine through its own framework's view
/// facility, and the one framework here with a view layer does not share the others'.
pub fn meta(framework: &str, template: &str) -> Value {
    json!({
        "framework": framework,
        "version": crate_version(framework),
        "runtime": RUSTC,
        "adapter": "",
        "template": template,
    })
}

pub fn port() -> u16 {
    std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080)
}

/// Fixture first, then the port. A target that binds before it can answer is a target the
/// health probe lets through and the gate then fails for the wrong reason.
pub fn boot(framework: &str) -> u16 {
    if let Err(e) = rb_domain::load(&rb_domain::fixture_path()) {
        eprintln!("fixture: {e}");
        std::process::exit(1);
    }
    let p = port();
    eprintln!("container/{framework} listening on {p}");
    p
}
