use axum::extract::rejection::JsonRejection;
use axum::http::HeaderMap;
use axum::http::header::CONTENT_LENGTH;
use axum::routing::post;
use axum::{Json, Router};
use axum_valid::{Valid, ValidRejection};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. The bind routes
/// take it through axum's Json and never run the rules. The validate routes take it through
/// axum-valid's Valid, which runs them before the handler and refuses the body with every error
/// validator reports, as JSON.
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

/// validator's errors for the first field that breaks its rule, refused as axum-valid refuses
/// the validate routes.
fn stop_at_first(order: &Order) -> Result<(), ValidRejection<JsonRejection>> {
    let first = || -> Result<(), ValidationErrors> {
        CustomerId { customer_id: order.customer_id }.validate()?;
        Status { status: &order.status }.validate()?;
        Lines { lines: &order.lines }.validate()
    };
    first().map_err(ValidRejection::Valid)
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

/// body: the order parsed and bound by axum's Json on every route, and checked against its rules on
/// the validate routes. A body that is not JSON is refused by Json before any rule runs.
pub fn router() -> Router {
    Router::new()
        .route("/body/bind/small", post(|headers: HeaderMap, Json(order): Json<Order>| async move { Json(Bound::of(order, &headers)) }))
        .route("/body/bind/medium", post(|headers: HeaderMap, Json(order): Json<Order>| async move { Json(Bound::of(order, &headers)) }))
        .route("/body/validate/small", post(|headers: HeaderMap, Valid(Json(order)): Valid<Json<Order>>| async move {
            Json(Bound::of(order, &headers))
        }))
        .route("/body/validate/medium", post(|headers: HeaderMap, Valid(Json(order)): Valid<Json<Order>>| async move {
            Json(Bound::of(order, &headers))
        }))
        .route("/body/validate/first-error", post(|headers: HeaderMap, Json(order): Json<Order>| async move {
            stop_at_first(&order).map(|()| Json(Bound::of(order, &headers)))
        }))
}
