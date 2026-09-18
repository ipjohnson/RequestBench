//! middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//!
//! The layers are no-ops, so nothing they do is visible in a response and no assertion over
//! one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
//! practice: a test that calls the handler rather than the app passes while the layers never
//! ran at all. The test host boots the application, so the layers are in the path here by
//! construction, and that is the whole of what these three assert.
use super::floor;
use super::planned;
use super::send::send;

// rb:test middleware.none
#[actix_web::test]
async fn the_unlayered_route_answers_the_shared_payload() {
    let a = planned::ask("middleware.none");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test middleware.four
#[actix_web::test]
async fn four_layers_do_not_change_the_answer() {
    let a = planned::ask("middleware.four");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test middleware.sixteen
#[actix_web::test]
async fn sixteen_layers_do_not_change_it_either() {
    let a = planned::ask("middleware.sixteen");

    let got = send(&a).await;

    floor::check(&a, &got);
}
