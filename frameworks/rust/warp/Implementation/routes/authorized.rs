use warp::{Filter, Rejection};

use crate::refusals::Forbidden;
use crate::{Payloads, Routes, answer};

/// authorized: a filter on this one route that compares the Authorization header with
/// settings.json's bearer token before the handler runs, and rejects any other value, or none,
/// with a rejection the application's recover handler answers with 403.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler authorized.allowed,authorized.denied
    answer(warp::path!("authorized" / "small").and(warp::get()).and(bearer(p)).map(move || warp::reply::json(&p.small))).boxed()
}

// rb:wiring authorized.*
/// warp's own header::exact refuses a value that differs with 400, so the comparison is written
/// here, and refuses as warp's rejections example refuses, with a rejection of the application's
/// own.
fn bearer(p: &'static Payloads) -> impl Filter<Extract = (), Error = Rejection> + Clone {
    warp::header::optional::<String>("authorization")
        .and_then(move |given: Option<String>| {
            let allowed = given.as_deref().and_then(|value| value.strip_prefix("Bearer ")) == Some(p.settings.token.as_str());
            async move { if allowed { Ok(()) } else { Err(warp::reject::custom(Forbidden)) } }
        })
        .untuple_one()
}
// rb:end
