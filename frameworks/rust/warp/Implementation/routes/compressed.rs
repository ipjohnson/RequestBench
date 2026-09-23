use std::str::FromStr;

use warp::{Filter, Rejection, Reply};

use crate::{Payloads, Routes, serial};

/// compressed: these routes answer like any other. warp's gzip filter, on this family's routes
/// alone, compresses the answer when the request asks for it.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler compressed.gzip_small,compressed.identity_small
    let small = negotiated(warp::path!("compressed" / "small").and(warp::get()), move || serial::fresh(warp::reply::json(&p.small)));
    // rb:handler compressed.gzip_large,compressed.identity_large
    let large = negotiated(warp::path!("compressed" / "large").and(warp::get()), move || serial::fresh(warp::reply::json(&p.large)));
    small.or(large).unify().boxed()
}

// rb:wiring compressed.*
/// warp's compression::gzip filter compresses everything it wraps, at async-compression's default
/// level, and never reads Accept-Encoding. So once the route's path and method pass, the answer
/// goes through it when the request lists gzip, and around it when the request does not.
fn negotiated<P, H, R>(route: P, handler: H) -> Routes
where
    P: Filter<Extract = (), Error = Rejection> + Clone + Send + Sync + 'static,
    H: Fn() -> R + Clone + Send + Sync + 'static,
    R: Reply + 'static,
{
    let gzipped = route.clone().and(asks_for_gzip()).map(handler.clone()).with(warp::filters::compression::gzip()).map(Reply::into_response);
    let identity = route.map(handler).map(Reply::into_response);
    gzipped.or(identity).unify().boxed()
}

/// Passes a request whose Accept-Encoding lists gzip, and rejects any other as the route not
/// matching, so the request falls through to the answer that is not compressed.
fn asks_for_gzip() -> impl Filter<Extract = (), Error = Rejection> + Copy {
    warp::header::optional::<Codings>("accept-encoding")
        .and_then(|codings: Option<Codings>| async move {
            if codings.is_some_and(|c| c.gzip) { Ok(()) } else { Err(warp::reject::not_found()) }
        })
        .untuple_one()
}

/// Whether an Accept-Encoding value lists gzip with a weight above zero.
struct Codings {
    gzip: bool,
}

impl FromStr for Codings {
    type Err = std::convert::Infallible;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let gzip = value.split(',').any(|coding| {
            let mut parts = coding.split(';').map(str::trim);
            let named = parts.next().is_some_and(|name| name.eq_ignore_ascii_case("gzip"));
            let refused = parts.any(|param| param.strip_prefix("q=").and_then(|q| q.parse::<f32>().ok()) == Some(0.0));
            named && !refused
        });
        Ok(Codings { gzip })
    }
}
// rb:end
