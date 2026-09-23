use std::fmt;

use poem::error::ResponseError;
use poem::http::header::CONTENT_LENGTH;
use poem::http::{HeaderMap, StatusCode};
use poem::web::Json;
use poem::{IntoResponse, Response, Route, handler, post};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

use crate::Payloads;

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. poem's Json
/// extractor binds it on every route. The validate routes then run the validator crate's rules,
/// and refuse the body with every error validator reports.
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

/// validator's errors for the first field that breaks its rule.
fn stop_at_first(order: &Order) -> Result<(), ValidationErrors> {
    CustomerId { customer_id: order.customer_id }.validate()?;
    Status { status: &order.status }.validate()?;
    Lines { lines: &order.lines }.validate()
}

/// A refusal as poem's error type. poem writes an error as its message in text, and its
/// documentation gives an error type of its own a JSON body by writing `as_response`. This one
/// writes validator's own errors with poem's Json.
#[derive(Debug)]
struct Refused(ValidationErrors);

impl fmt::Display for Refused {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl std::error::Error for Refused {}

impl ResponseError for Refused {
    fn status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }

    fn as_response(&self) -> Response {
        Json(&self.0).with_status(self.status()).into_response()
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
    fn of(order: Order, headers: &HeaderMap) -> Json<Bound> {
        let bytes = headers.get(CONTENT_LENGTH).and_then(|v| v.to_str().ok()?.parse().ok()).unwrap_or(0);
        Json(Bound { fields: 2 + 2 * order.lines.len(), bytes, echo: order })
    }
}

// rb:handler body.bind_small,body.bind_medium
/// The order as poem's Json binds it, and no rule.
#[handler]
fn bind(Json(order): Json<Order>, headers: &HeaderMap) -> Json<Bound> {
    Bound::of(order, headers)
}

// rb:handler body.validate_small,body.validate_medium,body.rejected_all,errors.malformed
/// Every rule, and every error validator reports. A body that is not JSON is refused by poem's
/// Json extractor before the handler runs.
#[handler]
fn validate(Json(order): Json<Order>, headers: &HeaderMap) -> Result<Json<Bound>, Refused> {
    order.validate().map_err(Refused)?;
    Ok(Bound::of(order, headers))
}

// rb:handler body.rejected_first
/// The rules one field at a time, refused at the first field that breaks one.
#[handler]
fn first_error(Json(order): Json<Order>, headers: &HeaderMap) -> Result<Json<Bound>, Refused> {
    stop_at_first(&order).map_err(Refused)?;
    Ok(Bound::of(order, headers))
}

/// body: the order parsed and bound by poem's Json on every route, and checked against its rules
/// on the validate routes.
pub fn add(route: Route, _: &'static Payloads) -> Route {
    route
        .at("/body/bind/small", post(bind))
        .at("/body/bind/medium", post(bind))
        .at("/body/validate/small", post(validate))
        .at("/body/validate/medium", post(validate))
        .at("/body/validate/first-error", post(first_error))
}
