//! What every Rust target needs from the host: the port to bind, what to answer on
//! /__meta, and the one template engine they all render with.
//!
//! Only the container contract is implemented. That is Cloud Run's contract and therefore
//! covers Fargate, ECS and plain Docker unchanged; the function hosts have no first-party
//! Rust runtime worth measuring, and a hand-written shim would measure the shim.

use minijinja::{context, Environment};
use rb_domain::PayloadBody;
use serde_json::{json, Value};
use std::sync::OnceLock;

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
/// requests. `template` is the engine the template family renders with, which every Rust
/// target shares for the same reason the gzip level is pinned.
pub fn meta(framework: &str) -> Value {
    json!({
        "framework": framework,
        "version": crate_version(framework),
        "runtime": RUSTC,
        "adapter": "",
        "template": format!("minijinja {}", crate_version("minijinja")),
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

// ---- template ----------------------------------------------------------------
//
// The same markup as every other language's items template. The spec pins content and
// leaves whitespace free, because five engines cannot agree on formatting without every
// template being contorted to match.
const ITEMS: &str = r#"<!doctype html>
<html>
  <head><title>items</title></head>
  <body>
    <h1>{{ size }}</h1>
    <table>
      <thead>
        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>
      </thead>
      <tbody>
        {% for it in items %}
        <tr>
          <td>{{ it.id }}</td>
          <td>{{ it.name }}</td>
          <td>{{ it.category }}</td>
          <td>{{ it.price_cents }}</td>
          <td>{% if it.in_stock %}yes{% else %}no{% endif %}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    <p>{{ count }} rows</p>
  </body>
</html>"#;

static ENV: OnceLock<Environment<'static>> = OnceLock::new();

fn env() -> &'static Environment<'static> {
    ENV.get_or_init(|| {
        let mut e = Environment::new();
        e.add_template("items", ITEMS).expect("items template");
        e
    })
}

/// Renders the items table. Parsed once and rendered per request, which is what the other
/// languages do: a precomputed string would measure nothing.
pub fn render_items(body: &PayloadBody) -> String {
    env()
        .get_template("items")
        .expect("items template")
        .render(context! { size => body.size, count => body.count, items => &body.items })
        .unwrap_or_default()
}
