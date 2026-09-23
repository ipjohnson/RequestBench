use actix_web::error::InternalError;
use actix_web::http::header::CONTENT_LENGTH;
use actix_web::web::{self, ServiceConfig};
use actix_web::{HttpRequest, HttpResponse};
use actix_web_validator::JsonConfig;
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. The bind routes
/// take it through actix-web's Json and never run the rules. The validate routes take it through
/// actix-web-validator's Json, which runs them before the handler.
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

/// validator's errors, as JSON, with 400. actix-web-validator answers a broken rule with the same
/// errors written as lines of text, so its JsonConfig's error handler answers with the errors
/// themselves, the custom answer its documentation shows the handler for.
fn refusal(errors: ValidationErrors) -> actix_web::Error {
    let answer = HttpResponse::BadRequest().json(&errors);
    InternalError::from_response(errors, answer).into()
}

/// The error handler: a broken rule is answered by `refusal`, and anything else, such as a body
/// that is not JSON, as actix-web-validator answers it.
fn refused(error: actix_web_validator::Error, _: &HttpRequest) -> actix_web::Error {
    match error {
        actix_web_validator::Error::Validate(errors) => refusal(errors),
        other => other.into(),
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

/// validator's errors for the first field that breaks its rule, refused as the validate routes
/// refuse.
fn stop_at_first(order: &Order) -> Result<(), actix_web::Error> {
    let first = || -> Result<(), ValidationErrors> {
        CustomerId { customer_id: order.customer_id }.validate()?;
        Status { status: &order.status }.validate()?;
        Lines { lines: &order.lines }.validate()
    };
    first().map_err(refusal)
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
    fn of(order: Order, request: &HttpRequest) -> web::Json<Bound> {
        let bytes = request.headers().get(CONTENT_LENGTH).and_then(|v| v.to_str().ok()?.parse().ok()).unwrap_or(0);
        web::Json(Bound { fields: 2 + 2 * order.lines.len(), bytes, echo: order })
    }
}

/// body: the order parsed and bound by a Json extractor on every route, and checked against its
/// rules on the validate routes. A body that is not JSON is refused by the extractor before any
/// rule runs.
pub fn configure(cfg: &mut ServiceConfig) {
    // rb:wiring body.*
    let rules = JsonConfig::default().error_handler(refused);

    cfg.route("/body/bind/small", web::post().to(|request: HttpRequest, order: web::Json<Order>| async move { Bound::of(order.into_inner(), &request) }))
        .route("/body/bind/medium", web::post().to(|request: HttpRequest, order: web::Json<Order>| async move { Bound::of(order.into_inner(), &request) }))
        .service(web::resource("/body/validate/small").app_data(rules.clone()).route(web::post().to(|request: HttpRequest, order: actix_web_validator::Json<Order>| async move {
            Bound::of(order.into_inner(), &request)
        })))
        .service(web::resource("/body/validate/medium").app_data(rules).route(web::post().to(|request: HttpRequest, order: actix_web_validator::Json<Order>| async move {
            Bound::of(order.into_inner(), &request)
        })))
        .route("/body/validate/first-error", web::post().to(|request: HttpRequest, order: web::Json<Order>| async move {
            stop_at_first(&order).map(|()| Bound::of(order.into_inner(), &request))
        }));
}
