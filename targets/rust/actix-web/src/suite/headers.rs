//! headers: reading request headers, at a few and at many.
//!
//! The header count is the variable and the body is fixed, so a target that stopped reading
//! headers at some limit would answer this correctly and still be wrong. What a response can
//! hold is that the request was accepted with all of them attached, which is what these do.
use super::floor;
use super::planned;
use super::send::send;

// rb:test headers.few
#[actix_web::test]
async fn a_request_carrying_a_few_headers_is_served() {
    let a = planned::ask("headers.few");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test headers.many
#[actix_web::test]
async fn and_one_carrying_many_is_served_the_same_way() {
    let a = planned::ask("headers.many");

    let got = send(&a).await;

    floor::check(&a, &got);
}
