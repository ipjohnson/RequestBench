//! compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//!
//! The family a test client can quietly fail to reach. Where a target compresses inside the
//! application an in-process client still runs the codec; where the compression belongs to the
//! server underneath, no in-process client reaches it and the only honest test is one over a real port.
//!
//! The second trap is the client. Some of the clients here decode gzip before the body is
//! read, so a test reading the decoded body would pass every assertion below against an identity
//! response. The suite's own send says whether this one does.
use super::floor;
use super::planned;
use super::send::send;

// rb:test compressed.identity_small
#[actix_web::test]
async fn a_client_that_will_not_take_gzip_is_answered_in_full() {
    let a = planned::ask("compressed.identity_small");

    let got = send(&a).await;

    floor::check(&a, &got);
    assert_eq!(got.encoding, "");
}

// rb:test compressed.identity_large
#[actix_web::test]
async fn the_large_payload_is_uncompressed_too_when_identity_was_asked_for() {
    let a = planned::ask("compressed.identity_large");

    let got = send(&a).await;

    floor::check(&a, &got);
    assert_eq!(got.encoding, "");
}

// rb:test compressed.gzip_small
#[actix_web::test]
async fn a_payload_under_the_shared_floor_is_gzipped_anyway() {
    let a = planned::ask("compressed.gzip_small");

    let got = send(&a).await;

    floor::check(&a, &got);
    // spec/expected.json pins no encoding here: the small payload sits under the shared gzip
    // floor and the frameworks disagree about what to do with it. actix-web's Compress
    // middleware gzips it anyway, 125 bytes into 125, which is no smaller than it started.
    assert_eq!(got.encoding, "gzip");
}

// rb:test compressed.gzip_large
#[actix_web::test]
async fn a_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on() {
    let a = planned::ask("compressed.gzip_large");

    let got = send(&a).await;

    floor::check(&a, &got);
    assert_eq!(got.encoding, "gzip");
    // A target that gzips without Vary: Accept-Encoding passes the floor and is wrong in
    // front of any shared cache.
    let vary = got.headers.get("vary").map(|v| v.to_lowercase()).unwrap_or_default();
    assert!(vary.contains("accept-encoding"), "vary {vary:?}");
}
