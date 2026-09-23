use std::convert::Infallible;

use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, catchers, post, routes};
use rocket_validation::{Validated, validation_catcher};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

use crate::Payloads;

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. The bind routes
/// take it through Rocket's Json data guard and never run the rules. The validate routes take it
/// through rocket-validation's Validated guard, which runs them after Json has bound the body and
/// fails with 422, and its catcher answers with every error validator reports, as JSON.
#[derive(Deserialize, Serialize, Validate)]
#[serde(rename_all = "camelCase")]
struct Order {
    #[validate(range(min = 1))]
    customer_id: i64,
    #[validate(length(min = 1))]
    status: String,
    #[validate(length(min = 1))]
    #[validate]
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
// first-error route is wired by hand. Its body checks Order's fields in the order Order declares
// them, each against its rule in a struct of its own, and stops at the first that fails. It goes
// through the same Validated guard, so it is refused as the validate routes are.
#[derive(Deserialize)]
#[serde(transparent)]
struct FirstRule(Order);

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
    #[validate(length(min = 1))]
    #[validate]
    lines: &'a [Line],
}

impl Validate for FirstRule {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let order = &self.0;
        CustomerId { customer_id: order.customer_id }.validate()?;
        Status { status: &order.status }.validate()?;
        Lines { lines: &order.lines }.validate()
    }
}
// rb:end

/// The length the client declared for the body, which the answer reports. Rocket's Json guard
/// reads the body and keeps no count of it.
struct Received(u64);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Received {
    type Error = Infallible;

    async fn from_request(request: &'r Request<'_>) -> request::Outcome<Self, Infallible> {
        Outcome::Success(Received(request.headers().get_one("content-length").and_then(|v| v.parse().ok()).unwrap_or(0)))
    }
}

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
    fn of(order: Order, received: Received) -> Json<Bound> {
        Json(Bound { fields: 2 + 2 * order.lines.len(), bytes: received.0, echo: order })
    }
}

/// body: the order parsed and bound by Rocket's Json on every route, and checked against its
/// rules on the validate routes. A body that is not JSON fails Json with 400 before any rule runs.
#[post("/body/bind/small", data = "<order>")]
fn bind_small(received: Received, order: Json<Order>) -> Json<Bound> {
    Bound::of(order.into_inner(), received)
}

#[post("/body/bind/medium", data = "<order>")]
fn bind_medium(received: Received, order: Json<Order>) -> Json<Bound> {
    Bound::of(order.into_inner(), received)
}

#[post("/body/validate/small", data = "<order>")]
fn validate_small(received: Received, order: Validated<Json<Order>>) -> Json<Bound> {
    Bound::of(order.into_deep_inner(), received)
}

#[post("/body/validate/medium", data = "<order>")]
fn validate_medium(received: Received, order: Validated<Json<Order>>) -> Json<Bound> {
    Bound::of(order.into_deep_inner(), received)
}

#[post("/body/validate/first-error", data = "<order>")]
fn validate_first(received: Received, order: Validated<Json<FirstRule>>) -> Json<Bound> {
    Bound::of(order.into_deep_inner().0, received)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket
        .mount("/", routes![bind_small, bind_medium, validate_small, validate_medium, validate_first])
        // rb:wiring body.*
        // rocket-validation's catcher for the 422 its guard fails with, on the body routes alone.
        .register("/body", catchers![validation_catcher])
}
