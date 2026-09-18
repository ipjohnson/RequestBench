//! headers: request headers at a few and at many, read by nothing on /headers and bound on
//! /headers/bind.
//!
//! /headers answers a fixed body, so what a response there can hold is that the request was
//! accepted with all of them attached. /headers/bind echoes the three it binds, and the plan
//! reader fills the pinned echo with the values this binary drew, so the floor check there
//! holds that each one was bound and the account converted to an integer.
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

// rb:test headers.bind_few
#[actix_web::test]
async fn three_bound_headers_come_back_in_the_echo() {
    let a = planned::ask("headers.bind_few");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test headers.bind_many
#[actix_web::test]
async fn and_the_same_three_among_many() {
    let a = planned::ask("headers.bind_many");

    let got = send(&a).await;

    floor::check(&a, &got);
}
