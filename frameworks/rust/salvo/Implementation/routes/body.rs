use salvo::http::header::CONTENT_LENGTH;
use salvo::http::{ParseError, ParseResult, Problem};
use salvo::prelude::*;
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. Every route binds
/// it with Salvo's parse_json. The validate routes then run the validator crate's rules, because
/// Salvo has no validation of its own.
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

fn stop_at_first(order: &Order) -> Result<(), ValidationErrors> {
    CustomerId { customer_id: order.customer_id }.validate()?;
    Status { status: &order.status }.validate()?;
    Lines { lines: &order.lines }.validate()
}

/// The problem's errors member: validator's ValidationErrors as validator serialises them.
#[derive(Serialize)]
struct Invalid {
    errors: ValidationErrors,
}

/// Why an order was refused. Salvo answers a body it cannot read with its own ParseError, a 400.
/// A body that breaks a rule is answered with Salvo's RFC 9457 Problem, as Salvo's documentation
/// shows a validation failure: 422, with validator's errors as the problem's errors member.
enum Refused {
    Unread(ParseError),
    Broken(ValidationErrors),
}

impl From<ParseError> for Refused {
    fn from(e: ParseError) -> Self {
        Refused::Unread(e)
    }
}

impl From<ValidationErrors> for Refused {
    fn from(errors: ValidationErrors) -> Self {
        Refused::Broken(errors)
    }
}

#[async_trait]
impl Writer for Refused {
    async fn write(self, req: &mut Request, depot: &mut Depot, res: &mut Response) {
        match self {
            Refused::Unread(e) => e.write(req, depot, res).await,
            Refused::Broken(errors) => res.render(Problem::new(StatusCode::UNPROCESSABLE_ENTITY).with_extensions(Invalid { errors })),
        }
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
    fn of(order: Order, bytes: u64) -> Bound {
        Bound { fields: 2 + 2 * order.lines.len(), bytes, echo: order }
    }
}

fn length(req: &Request) -> u64 {
    req.header(CONTENT_LENGTH).unwrap_or(0)
}

// rb:handler body.bind_small,body.bind_medium
/// The order parsed and bound, with no rule run.
#[handler]
async fn bind(req: &mut Request) -> ParseResult<Json<Bound>> {
    let bytes = length(req);
    Ok(Json(Bound::of(req.parse_json().await?, bytes)))
}

// rb:handler body.validate_small,body.validate_medium,body.rejected_all,errors.malformed
/// The order bound, then checked against every rule.
#[handler]
async fn validate(req: &mut Request) -> Result<Json<Bound>, Refused> {
    let bytes = length(req);
    let order: Order = req.parse_json().await?;
    order.validate()?;
    Ok(Json(Bound::of(order, bytes)))
}

// rb:handler body.rejected_first
/// The order bound, then checked a field at a time until one fails.
#[handler]
async fn first_error(req: &mut Request) -> Result<Json<Bound>, Refused> {
    let bytes = length(req);
    let order: Order = req.parse_json().await?;
    stop_at_first(&order)?;
    Ok(Json(Bound::of(order, bytes)))
}

/// body: the order parsed and bound by Salvo's parse_json on every route, and checked against its
/// rules on the validate routes. A body that is not JSON is refused by parse_json before any rule
/// runs.
pub fn router() -> Router {
    Router::with_path("/body")
        .push(Router::with_path("bind/small").post(bind))
        .push(Router::with_path("bind/medium").post(bind))
        .push(Router::with_path("validate/small").post(validate))
        .push(Router::with_path("validate/medium").post(validate))
        .push(Router::with_path("validate/first-error").post(first_error))
}
