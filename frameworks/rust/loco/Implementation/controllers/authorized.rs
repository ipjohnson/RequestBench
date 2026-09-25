use axum::extract::FromRequestParts;
use axum::http::StatusCode;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use loco_rs::controller::ErrorDetail;
use loco_rs::prelude::*;

use crate::Payloads;

// rb:wiring authorized.*
/// settings.json's bearer token, checked by an extractor before the handler runs, as Loco's own
/// auth extractors check a JWT or an API key. Those look a user up in a database, which this
/// application has none of. Any other token is refused with Loco's error JSON and 403.
pub struct Bearer;

impl FromRequestParts<AppContext> for Bearer {
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, ctx: &AppContext) -> Result<Self> {
        let p: &'static Payloads = ctx.shared_store.get().ok_or(Error::InternalServerError)?;
        let token = parts.headers.get(AUTHORIZATION).and_then(|value| value.to_str().ok()).and_then(|value| value.strip_prefix("Bearer "));
        if token == Some(p.settings.token.as_str()) {
            Ok(Bearer)
        } else {
            Err(Error::CustomError(StatusCode::FORBIDDEN, ErrorDetail::new("forbidden", "The bearer token is not one this application accepts")))
        }
    }
}
// rb:end

// rb:handler authorized.allowed,authorized.denied
async fn small(_: Bearer, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    format::json(&p.small)
}

pub fn routes() -> Routes {
    Routes::new().prefix("authorized").add("/small", get(small))
}
