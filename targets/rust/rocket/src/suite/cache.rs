//! cache: the framework's own response cache, and what it is keyed on.
//!
//! The vary rows are the ones worth having. A store keyed on fewer headers than it declares
//! answers one tenant with another tenant's body, and that is a correctness failure a latency
//! chart renders as a target that got faster.
use super::floor;
use super::planned;
use super::send::send;

// rb:test cache.small
#[test]
fn the_small_cached_response_is_what_the_spec_pins() {
    let a = planned::ask("cache.small");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test cache.medium
#[test]
fn the_medium_one_is_too() {
    let a = planned::ask("cache.medium");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test cache.large
#[test]
fn and_the_large_one() {
    let a = planned::ask("cache.large");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test cache.vary_one
#[test]
fn a_response_varying_on_one_header_says_so() {
    let a = planned::ask("cache.vary_one");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test cache.vary_many
#[test]
fn and_one_varying_on_three_says_all_three() {
    let a = planned::ask("cache.vary_many");

    let got = send(&a);

    floor::check(&a, &got);
}
