//! template: server-side HTML, at two sizes.
//!
//! The one family whose body is not compared byte for byte. Five template engines cannot
//! agree on formatting without every template being contorted to match, so the spec pins the
//! content and leaves the whitespace free: same elements, same order, same values. The floor
//! normalises both sides the way the conformance client does.
use super::floor;
use super::planned;
use super::send::send;

// rb:test template.small
#[test]
fn the_small_template_renders_the_pinned_content() {
    let a = planned::ask("template.small");

    let got = send(&a);

    floor::check(&a, &got);
    assert!(got.content_type.starts_with("text/html"), "content-type {}", got.content_type);
}

// rb:test template.medium
#[test]
fn the_medium_template_does_too() {
    let a = planned::ask("template.medium");

    let got = send(&a);

    floor::check(&a, &got);
}
