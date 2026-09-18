//! domain: the eight operations that reach the shared model, including the four that write.
//!
//! The largest family and the one where a handler is doing something rather than returning
//! something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
//! with no body are both answers a framework can get subtly wrong while returning the right
//! status, which is why the floor checks the kind of body even when there is none.
use super::floor;
use super::planned;
use super::send::send;

// rb:test domain.lookup
#[tokio::test]
async fn one_order_is_looked_up() {
    let a = planned::ask("domain.lookup");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.filter
#[tokio::test]
async fn a_filtered_list_comes_back() {
    let a = planned::ask("domain.filter");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.join
#[tokio::test]
async fn a_join_across_the_model_comes_back() {
    let a = planned::ask("domain.join");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.aggregate
#[tokio::test]
async fn an_aggregate_is_computed() {
    let a = planned::ask("domain.aggregate");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.create
#[tokio::test]
async fn a_created_order_answers_201() {
    let a = planned::ask("domain.create");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.replace
#[tokio::test]
async fn a_replaced_customer_answers_the_new_state() {
    let a = planned::ask("domain.replace");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.patch
#[tokio::test]
async fn a_patched_customer_answers_the_merged_state() {
    let a = planned::ask("domain.patch");

    let got = send(&a).await;

    floor::check(&a, &got);
}

// rb:test domain.delete
#[tokio::test]
async fn a_deleted_line_answers_204_and_no_body() {
    let a = planned::ask("domain.delete");

    let got = send(&a).await;

    floor::check(&a, &got);
    assert!(got.raw.is_empty(), "{} body bytes", got.raw.len());
}
