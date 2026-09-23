use std::convert::Infallible;

use rocket::data::{Data, FromData, Outcome as DataOutcome};
use rocket::outcome::Outcome;
use rocket::request::{self, FromRequest, Request};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, catch, catchers, post, routes};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

use crate::Payloads;

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. The bind routes
/// take it through Rocket's Json data guard and never run the rules. The validate routes take it
/// through the Validated guard below, which runs them after Json has bound the body and fails with
/// 422, and the catcher below answers with every error validator reports, as JSON.
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
    #[validate(length(min = 1), nested)]
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

/// A body bound by Rocket's Json and then checked against its rules. Rocket validates forms but
/// not JSON, and rocket-validation, the crate that joins the two, pins validator 0.16, so the guard
/// is this application's own. A body that breaks a rule fails with 422, and its errors wait in the
/// request's local cache for the catcher.
struct Validated<T>(T);

/// The errors the Validated guard found, or None when the 422 came from Json, such as for a value of
/// the wrong type.
struct Broken(Option<ValidationErrors>);

#[rocket::async_trait]
impl<'r, T: Validate + Deserialize<'r>> FromData<'r> for Validated<T> {
    type Error = Option<ValidationErrors>;

    async fn from_data(request: &'r Request<'_>, data: Data<'r>) -> DataOutcome<'r, Self> {
        match Json::<T>::from_data(request, data).await {
            Outcome::Success(body) => match body.validate() {
                Ok(()) => Outcome::Success(Validated(body.into_inner())),
                Err(errors) => {
                    request.local_cache(|| Broken(Some(errors.clone())));
                    Outcome::Error((rocket::http::Status::UnprocessableEntity, Some(errors)))
                }
            },
            Outcome::Error((status, _)) => Outcome::Error((status, None)),
            Outcome::Forward(forward) => Outcome::Forward(forward),
        }
    }
}

/// What a 422 on the body routes answers: its code, a message, and validator's errors, or null when
/// the guard found none.
#[derive(Serialize)]
struct Refusal<'a> {
    code: u16,
    message: &'static str,
    errors: Option<&'a ValidationErrors>,
}

#[catch(422)]
fn unprocessable<'a>(request: &'a Request<'_>) -> Json<Refusal<'a>> {
    Json(Refusal {
        code: 422,
        message: "Unprocessable Entity. The request was well-formed but was unable to be followed due to semantic errors.",
        errors: request.local_cache(|| Broken(None)).0.as_ref(),
    })
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
fn validate_small(received: Received, order: Validated<Order>) -> Json<Bound> {
    Bound::of(order.0, received)
}

#[post("/body/validate/medium", data = "<order>")]
fn validate_medium(received: Received, order: Validated<Order>) -> Json<Bound> {
    Bound::of(order.0, received)
}

#[post("/body/validate/first-error", data = "<order>")]
fn validate_first(received: Received, order: Validated<FirstRule>) -> Json<Bound> {
    Bound::of(order.0.0, received)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket
        .mount("/", routes![bind_small, bind_medium, validate_small, validate_medium, validate_first])
        // rb:wiring body.*
        // The catcher for the 422 the Validated guard fails with, on the body routes alone.
        .register("/body", catchers![unprocessable])
}
