use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};
use warp::{Filter, Rejection};

use crate::refusals::Invalid;
use crate::{Routes, answer};

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. Every route binds
/// it with warp's json body filter. The validate routes then run the rules, and reject the body
/// with every error validator reports, which the application's recover handler answers.
#[derive(Deserialize, Serialize, Validate)]
#[serde(rename_all = "camelCase")]
struct Order {
    #[validate(range(min = 1))]
    customer_id: i64,
    #[validate(length(min = 1))]
    status: String,
    #[validate(length(min = 1), nested)]
    lines: Vec<Line>,
}

#[derive(Deserialize, Serialize, Validate)]
#[serde(rename_all = "camelCase")]
struct Line {
    #[validate(range(min = 1))]
    product_id: i64,
    #[validate(range(min = 1))]
    qty: i64,
}

/// The order, or a rejection carrying every rule it broke.
async fn checked(order: Order) -> Result<Order, Rejection> {
    match order.validate() {
        Ok(()) => Ok(order),
        Err(errors) => Err(warp::reject::custom(Invalid(errors))),
    }
}

// validator runs every rule a struct declares and has no way to stop at the first, so the
// first-error route is wired by hand. It checks Order's fields in the order Order declares them,
// each against its rule in a struct of its own, and stops at the first that fails.
#[derive(Validate)]
struct CustomerId {
    #[validate(range(min = 1))]
    customer_id: i64,
}

#[derive(Validate)]
struct Status<'a> {
    #[validate(length(min = 1))]
    status: &'a str,
}

#[derive(Validate)]
struct Lines<'a> {
    #[validate(length(min = 1), nested)]
    lines: &'a [Line],
}

/// The order, or a rejection carrying validator's errors for the first field that breaks its rule.
async fn checked_to_first(order: Order) -> Result<Order, Rejection> {
    let first = || -> Result<(), ValidationErrors> {
        CustomerId { customer_id: order.customer_id }.validate()?;
        Status { status: &order.status }.validate()?;
        Lines { lines: &order.lines }.validate()
    };
    match first() {
        Ok(()) => Ok(order),
        Err(errors) => Err(warp::reject::custom(Invalid(errors))),
    }
}
// rb:end

/// What a bind or validate row answers: the order back, with the leaves the handler found in it
/// and the bytes it received.
#[derive(Serialize)]
struct Bound {
    fields: usize,
    bytes: u64,
    echo: Order,
}

impl Bound {
    /// customerId and status, and a productId and a qty per line.
    fn of(length: Option<u64>, order: Order) -> warp::reply::Json {
        warp::reply::json(&Bound { fields: 2 + 2 * order.lines.len(), bytes: length.unwrap_or(0), echo: order })
    }
}

/// body: the order parsed and bound by warp's json body filter on every route, and checked against
/// its rules on the validate routes. A body that is not JSON is refused by the filter before any
/// rule runs.
pub fn routes() -> Routes {
    let length = || warp::header::optional::<u64>("content-length");
    // rb:handler body.bind_small
    let bind_small = warp::path!("body" / "bind" / "small").and(warp::post()).and(length()).and(warp::body::json()).map(Bound::of);
    // rb:handler body.bind_medium
    let bind_medium = warp::path!("body" / "bind" / "medium").and(warp::post()).and(length()).and(warp::body::json()).map(Bound::of);
    // rb:handler body.validate_small,body.rejected_all,errors.malformed
    let validate_small = warp::path!("body" / "validate" / "small").and(warp::post()).and(length()).and(warp::body::json().and_then(checked)).map(Bound::of);
    // rb:handler body.validate_medium
    let validate_medium = warp::path!("body" / "validate" / "medium").and(warp::post()).and(length()).and(warp::body::json().and_then(checked)).map(Bound::of);
    // rb:handler body.rejected_first
    let first_error = warp::path!("body" / "validate" / "first-error").and(warp::post()).and(length()).and(warp::body::json().and_then(checked_to_first)).map(Bound::of);
    answer(bind_small.or(bind_medium).unify().or(validate_small).unify().or(validate_medium).unify().or(first_error).unify()).boxed()
}
