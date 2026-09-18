//! query: parsing and coercing query parameters, at one and at eight.
//!
//! The values never reach the answer, which is the point: this family is the parse and the
//! coercion isolated from any use of them. A target that silently drops a parameter it cannot
//! coerce answers the same body as one that read all eight, so what these hold is the status.
use super::floor;
use super::planned;
use super::send::send;

// rb:test query.one
#[test]
fn one_query_parameter_is_read() {
    let a = planned::ask("query.one");

    let got = send(&a);

    floor::check(&a, &got);
}

// rb:test query.many
#[test]
fn eight_of_them_are_read_and_coerced() {
    let a = planned::ask("query.many");

    let got = send(&a);

    floor::check(&a, &got);
}
