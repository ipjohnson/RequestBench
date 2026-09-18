//! body: binding and validating a request body, at two sizes and two refusals.
//!
//! Where the six Rust targets stop agreeing. Each reaches a different validation facility, and
//! the two refusals are judged as envelopes because what a framework answers when a body is wrong
//! is its own contract, not this repository's.
use super::envelope;
use super::floor;
use super::planned;
use super::send::{TARGET, send};

// rb:test body.bind_small
#[tokio::test]
async fn a_small_body_binds() {
    let a = planned::ask("body.bind_small");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test body.bind_medium
#[tokio::test]
async fn a_medium_body_binds() {
    let a = planned::ask("body.bind_medium");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test body.validate_small
#[tokio::test]
async fn a_small_body_that_is_valid_passes_validation() {
    let a = planned::ask("body.validate_small");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test body.validate_medium
#[tokio::test]
async fn a_medium_body_that_is_valid_does_too() {
    let a = planned::ask("body.validate_medium");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test body.rejected_all
#[tokio::test]
async fn a_body_failing_three_rules_is_refused() {
    let a = planned::ask("body.rejected_all");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}

// rb:test body.rejected_first
#[tokio::test]
async fn a_body_failing_one_rule_is_refused_the_same_way() {
    let a = planned::ask("body.rejected_first");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}
