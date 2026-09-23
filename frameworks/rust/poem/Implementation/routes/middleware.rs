use poem::endpoint::make_sync;
use poem::web::Json;
use poem::{Endpoint, EndpointExt, Middleware, Request, Result, Route, get};

use crate::Payloads;

/// middleware: no-op layers in front of the handler. A poem middleware turns the endpoint it is
/// given into another, and `with` puts one on this route alone.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/middleware/none", get(make_sync(move |_| Json(&p.small))))
        .at("/middleware/four", four(get(make_sync(move |_| Json(&p.small)))))
        .at("/middleware/sixteen", four(four(four(four(get(make_sync(move |_| Json(&p.small))))))))
}

// rb:wiring middleware.*
/// A poem Middleware that hands the request to the endpoint it wraps and does nothing else.
struct Noop;

impl<E: Endpoint> Middleware<E> for Noop {
    type Output = Passed<E>;

    fn transform(&self, ep: E) -> Passed<E> {
        Passed(ep)
    }
}

struct Passed<E>(E);

impl<E: Endpoint> Endpoint for Passed<E> {
    type Output = E::Output;

    async fn call(&self, req: Request) -> Result<E::Output> {
        self.0.call(req).await
    }
}

/// Four layers of it. Each layer is a type of its own, so sixteen is four of four.
fn four(ep: impl Endpoint + 'static) -> impl Endpoint + 'static {
    ep.with(Noop).with(Noop).with(Noop).with(Noop)
}
// rb:end
