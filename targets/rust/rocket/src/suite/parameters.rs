//! parameters: route capture, at zero, one and two segments.
//!
//! The captured values do not reach the answer. The payload is the shared one, so what these
//! hold is that the route matched at all: a target whose two-segment pattern is wrong answers
//! 404 and the floor says so on the status line before it ever looks at a body.
use super::floor;
use super::planned;
use super::send::send;

// rb:test parameters.static
#[test]
fn a_route_with_nothing_to_capture_matches() {
    let a = planned::ask("parameters.static");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test parameters.one
#[test]
fn one_captured_segment_matches() {
    let a = planned::ask("parameters.one");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test parameters.two
#[test]
fn two_captured_segments_match() {
    let a = planned::ask("parameters.two");

    let got = send(&a);

    floor::check(&a, &got);
}
