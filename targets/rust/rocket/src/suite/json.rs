//! json: serialization cost at three sizes, and nothing else in the path.
//!
//! The three differ only in how much there is to serialize, so there is nothing here a test
//! can say that the floor does not already say better: the pinned body is the whole contract.
//! What the three tests are for is the ratchet. An endpoint with no test is counted, and
//! three that pass at three sizes is how a serializer that truncates the large one is caught.
use super::floor;
use super::planned;
use super::send::send;

// rb:test json.small
#[test]
fn the_small_payload_serializes_to_what_the_spec_pins() {
    let a = planned::ask("json.small");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test json.medium
#[test]
fn the_medium_payload_does_too() {
    let a = planned::ask("json.medium");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test json.large
#[test]
fn and_the_large_one_which_is_where_a_truncation_would_show() {
    let a = planned::ask("json.large");

    let got = send(&a);

    floor::check(&a, &got);
}
