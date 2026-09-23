use axum::extract::rejection::JsonRejection;
use axum::extract::{FromRequest, Request};
use axum::http::header::CONTENT_LENGTH;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationErrors};

// rb:wiring body.*
/// The body the bind and validate rows send, and the rules orderRequest states. The bind routes
/// take it through axum's Json and never run the rules. The validate routes take it through
/// ValidatedJson, which runs them before the handler and refuses the body with every error
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

/// axum's Json, then validator's rules, in an extractor like the one axum's validator example
/// writes for a form. A body Json refuses keeps Json's rejection. A body that breaks a rule is
/// refused with 400 and validator's errors as JSON, which is how axum-valid answers.
struct ValidatedJson<T>(T);

impl<T, S> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
    Json<T>: FromRequest<S, Rejection = JsonRejection>,
{
    type Rejection = Response;

    async fn from_request(request: Request, state: &S) -> Result<Self, Response> {
        let Json(value) = Json::<T>::from_request(request, state).await.map_err(IntoResponse::into_response)?;
        value.validate().map_err(refused)?;
        Ok(ValidatedJson(value))
    }
}

fn refused(errors: ValidationErrors) -> Response {
    (StatusCode::BAD_REQUEST, Json(errors)).into_response()
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

/// validator's errors for the first field that breaks its rule, refused as ValidatedJson refuses
/// the validate routes.
fn stop_at_first(order: &Order) -> Result<(), Response> {
    let first = || -> Result<(), ValidationErrors> {
        CustomerId { customer_id: order.customer_id }.validate()?;
        Status { status: &order.status }.validate()?;
        Lines { lines: &order.lines }.validate()
    };
    first().map_err(refused)
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
        .route("/body/validate/small", post(|headers: HeaderMap, ValidatedJson(order): ValidatedJson<Order>| async move {
            Json(Bound::of(order, &headers))
        }))
        .route("/body/validate/medium", post(|headers: HeaderMap, ValidatedJson(order): ValidatedJson<Order>| async move {
            Json(Bound::of(order, &headers))
        }))
        .route("/body/validate/first-error", post(|headers: HeaderMap, Json(order): Json<Order>| async move {
            stop_at_first(&order).map(|()| Json(Bound::of(order, &headers)))
        }))
}
