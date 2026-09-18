//! query: parsing, percent-decoding and coercing query parameters, at one and at eight.
//!
//! The answer is the small payload with an echo of every value the target bound, and the
//! values are drawn once per test binary, so the floor holds each of them as well as the
//! status. A target that drops a parameter, coerces one wrong or leaves the %20 in q undecoded
//! answers a different echo.
use super::floor;
use super::planned;
use super::send::send;

// rb:test query.one
#[actix_web::test]
async fn one_query_parameter_is_read() {
    let a = planned::ask("query.one");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test query.many
#[actix_web::test]
async fn eight_of_them_are_read_and_coerced() {
    let a = planned::ask("query.many");

    let got = send(&a).await;

    floor::check(&a, &got);
}
