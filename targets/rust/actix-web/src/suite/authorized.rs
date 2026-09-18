//! authorized: one endpoint that refuses, and one that does not.
//!
//! The pair is the test. A target that let everything through would pass the allowed case and
//! nothing else, so the denial is what carries the family, and its envelope is the
//! framework's own rather than this repository's.
use super::envelope;
use super::floor;
use super::planned;
use super::send::{TARGET, send};

// rb:test authorized.allowed
#[actix_web::test]
async fn a_request_carrying_the_token_is_served() {
    let a = planned::ask("authorized.allowed");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test authorized.denied
#[actix_web::test]
async fn a_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape() {
    let a = planned::ask("authorized.denied");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}
