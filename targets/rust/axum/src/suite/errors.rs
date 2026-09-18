//! errors: the three refusals that are nobody's fault but the request's.
//!
//! All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
//! the framework rather than the handler: nothing registers that path, so what answers is
//! whatever the target does with a route it does not have.
use super::envelope;
use super::planned;
use super::send::{TARGET, send};

// rb:test errors.not_found
#[tokio::test]
async fn a_registered_route_with_no_such_row_answers_404() {
    let a = planned::ask("errors.not_found");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}

// rb:test errors.unmatched
#[tokio::test]
async fn a_path_nothing_registers_answers_the_frameworks_own_404() {
    let a = planned::ask("errors.unmatched");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}

// rb:test errors.malformed
#[tokio::test]
async fn a_body_that_is_not_json_at_all_is_refused() {
    let a = planned::ask("errors.malformed");

    let got = send(&a).await;

    envelope::check(&a, &got, TARGET);
}
