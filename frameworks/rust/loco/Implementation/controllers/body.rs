use axum::http::HeaderMap;
use axum::http::header::CONTENT_LENGTH;
// Loco's prelude by name rather than by glob, and its ValidatorTrait only in the function that calls
// it. In scope, that trait's validate is one every Validate type has too, and the call validator's
// derive writes for a nested field becomes ambiguous.
use loco_rs::prelude::{Error, Json, JsonValidateWithMessage, Response, Result, Routes, format, post};
use serde::{Deserialize, Serialize};
use validator::Validate;

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states, as validator's
/// derive declares them. The bind routes take it through Loco's Json and never run the rules. The
/// validate routes take it through Loco's JsonValidateWithMessage, which runs them before the
/// handler and refuses the body with 400 and the rules it broke, by field.
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

// validator runs every rule a struct declares and has no way to stop at the first, so the
// first-error route checks Order's fields in the order Order declares them, each against its rule
// in a struct of its own. It refuses the body as JsonValidateWithMessage does, at the first field
// that fails.
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

fn stop_at_first(order: &Order) -> Result<()> {
    use loco_rs::validation::ValidatorTrait as Rules;
    Rules::validate(&CustomerId { customer_id: order.customer_id })
        .and_then(|()| Rules::validate(&Status { status: &order.status }))
        .and_then(|()| Rules::validate(&Lines { lines: &order.lines }))
        .map_err(Error::Validation)
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
    fn of(order: Order, headers: &HeaderMap) -> Bound {
        let bytes = headers.get(CONTENT_LENGTH).and_then(|v| v.to_str().ok()?.parse().ok()).unwrap_or(0);
        Bound { fields: 2 + 2 * order.lines.len(), bytes, echo: order }
    }
}

// rb:handler body.bind_small,body.bind_medium
async fn bind(headers: HeaderMap, Json(order): Json<Order>) -> Result<Response> {
    format::json(Bound::of(order, &headers))
}

// rb:handler body.validate_small,body.validate_medium,body.rejected_all,errors.malformed
async fn validate(headers: HeaderMap, JsonValidateWithMessage(order): JsonValidateWithMessage<Order>) -> Result<Response> {
    format::json(Bound::of(order, &headers))
}

// rb:handler body.rejected_first
async fn first_error(headers: HeaderMap, Json(order): Json<Order>) -> Result<Response> {
    stop_at_first(&order)?;
    format::json(Bound::of(order, &headers))
}

/// body: the order parsed and bound by Loco's Json on every route, and checked against its rules on
/// the validate routes. A body that is not JSON is refused before any rule runs.
pub fn routes() -> Routes {
    Routes::new()
        .prefix("body")
        .add("/bind/small", post(bind))
        .add("/bind/medium", post(bind))
        .add("/validate/small", post(validate))
        .add("/validate/medium", post(validate))
        .add("/validate/first-error", post(first_error))
}
