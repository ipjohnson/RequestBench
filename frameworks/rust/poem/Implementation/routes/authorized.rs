use poem::endpoint::make_sync;
use poem::http::StatusCode;
use poem::web::Json;
use poem::web::headers::authorization::{Authorization, Bearer};
use poem::web::headers::HeaderMapExt;
use poem::{Endpoint, EndpointExt, Error, Middleware, Request, Result, Route, get};

use crate::Payloads;

/// authorized: a poem middleware on this one route. It compares the bearer token in the
/// Authorization header with settings.json's before the handler runs, and refuses any other
/// token, or none, with 403.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route.at("/authorized/small", get(make_sync(move |_| Json(&p.small))).with(Token(&p.settings.token)))
}

// rb:wiring authorized.*
/// A Middleware written as poem's own basic-auth example writes one, reading the header with the
/// headers crate's typed Authorization. poem ships no authentication middleware.
struct Token(&'static str);

impl<E: Endpoint> Middleware<E> for Token {
    type Output = TokenEndpoint<E>;

    fn transform(&self, ep: E) -> TokenEndpoint<E> {
        TokenEndpoint { ep, token: self.0 }
    }
}

struct TokenEndpoint<E> {
    ep: E,
    token: &'static str,
}

impl<E: Endpoint> Endpoint for TokenEndpoint<E> {
    type Output = E::Output;

    async fn call(&self, req: Request) -> Result<E::Output> {
        match req.headers().typed_get::<Authorization<Bearer>>() {
            Some(Authorization(bearer)) if bearer.token() == self.token => self.ep.call(req).await,
            _ => Err(Error::from_status(StatusCode::FORBIDDEN)),
        }
    }
}
// rb:end
