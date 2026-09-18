//! parameters: route capture, at zero, one and two segments, on routes four segments deep.
//!
//! The captures reach the answer. Each is bound as an integer and echoed, and the plan reader
//! fills the pinned echo with the values this binary drew, so the floor check holds the
//! binding as well as the match. The static path is also a match for the one-capture route
//! beside it, so its test holds that the static route still answers it with the plain
//! payload.
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
fn one_captured_segment_is_bound_as_an_integer() {
    let a = planned::ask("parameters.one");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test parameters.two
#[test]
fn and_two_are_bound_the_same_way() {
    let a = planned::ask("parameters.two");

    let got = send(&a);

    floor::check(&a, &got);
}
