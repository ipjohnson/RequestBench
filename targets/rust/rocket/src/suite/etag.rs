//! etag: the validator a target computes, and what it does when one comes back.
//!
//! The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
//! the target has answered a different one, because the validator is the target's to produce.
use super::floor;
use super::planned;
use super::send::{send, send_after_capture};

// rb:test etag.small
#[test]
fn the_small_response_carries_a_validator() {
    let a = planned::ask("etag.small");

    let got = send(&a);

    floor::check(&a, &got);
    assert!(got.headers.contains_key("etag"), "no etag");
}

// rb:test etag.large
#[test]
fn so_does_the_large_one() {
    let a = planned::ask("etag.large");

    let got = send(&a);

    floor::check(&a, &got);
    assert!(got.headers.contains_key("etag"), "no etag");
}

// rb:test etag.match_large
#[test]
fn a_validator_the_target_just_issued_is_answered_with_304() {
    let a = planned::ask("etag.match_large");

    let got = send_after_capture(&a);

    floor::check(&a, &got);
    assert!(got.content_type.is_empty(), "content-type {}", got.content_type);
}

// rb:test etag.stale_large
#[test]
fn a_validator_the_target_never_issued_is_answered_in_full() {
    let a = planned::ask("etag.stale_large");

    let got = send(&a);

    floor::check(&a, &got);
    assert!(got.headers.contains_key("etag"), "no etag");
}
