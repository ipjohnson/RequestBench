use serde::Serialize;
use validator::ValidationErrors;
use warp::http::StatusCode;
use warp::reject::Reject;
use warp::{Rejection, Reply};

// rb:wiring body.*
/// A body that bound and broke its rules, with the errors validator reported for it.
#[derive(Debug)]
pub struct Invalid(pub ValidationErrors);

impl Reject for Invalid {}
// rb:end

// rb:wiring authorized.*
/// A request without settings.json's bearer token.
#[derive(Debug)]
pub struct Forbidden;

impl Reject for Forbidden {}
// rb:end

/// An API error serializable to JSON, as warp's rejections example writes one.
#[derive(Serialize)]
struct ErrorMessage {
    code: u16,
    message: String,
}

// rb:wiring body.*,authorized.*
/// The recover handler of warp's rejections example, for the two rejections this application
/// raises itself: a body validator refused, answered 400 with validator's report of every rule it
/// broke, and a wrong bearer token, answered 403. Every other rejection is passed along, so warp
/// answers it as it answers one nothing recovers.
pub async fn recover(rejection: Rejection) -> Result<impl Reply, Rejection> {
    let (code, message) = if let Some(Invalid(errors)) = rejection.find() {
        (StatusCode::BAD_REQUEST, errors.to_string())
    } else if let Some(Forbidden) = rejection.find() {
        (StatusCode::FORBIDDEN, "FORBIDDEN".to_owned())
    } else {
        return Err(rejection);
    };
    Ok(warp::reply::with_status(warp::reply::json(&ErrorMessage { code: code.as_u16(), message }), code))
}
// rb:end
