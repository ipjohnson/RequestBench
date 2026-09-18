//! baseline: the dispatch floor, with no serialization in the way.
//!
//! The one endpoint in the corpus that answers a literal. Its whole contract is the string
//! and the content type, and the content type is the half a test gets wrong: a target that
//! answers "Hello, World!" as application/json has passed the body and failed the endpoint.
//! The floor checks the kind of body before the body for that reason.
use super::floor;
use super::planned;
use super::send::send;

// rb:test baseline.plaintext
#[actix_web::test]
async fn the_plaintext_route_answers_a_literal_as_text() {
    let a = planned::ask("baseline.plaintext");

    let got = send(&a).await;

    floor::check(&a, &got);
    assert!(got.content_type.starts_with("text/plain"), "content-type {}", got.content_type);
}
