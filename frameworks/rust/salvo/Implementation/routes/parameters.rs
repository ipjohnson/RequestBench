use salvo::http::ParseResult;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Serialised};
use crate::payloads::Payload;

#[derive(Deserialize, Serialize)]
struct One {
    one: i64,
}

#[derive(Deserialize, Serialize)]
struct Two {
    one: i64,
    two: i64,
}

// rb:handler parameters.one
/// The capture bound as an integer by Salvo's parse_params, which refuses one that does not
/// convert with its own ParseError.
#[derive(Clone, Copy)]
struct OneCapture(&'static Payload);

#[handler]
impl OneCapture {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, One>>> {
        Ok(Json(Echoed::new(self.0, req.parse_params::<One>()?)))
    }
}
// rb:end

// rb:handler parameters.two
#[derive(Clone, Copy)]
struct TwoCaptures(&'static Payload);

#[handler]
impl TwoCaptures {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, Two>>> {
        Ok(Json(Echoed::new(self.0, req.parse_params::<Two>()?)))
    }
}
// rb:end

/// parameters: router captures, bound into a struct by Salvo's parse_params. Salvo tries the
/// routers in order, so the literal segment of the static route is pushed before the capture.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/parameters")
        .push(Router::with_path("static/segment/literal").get(Serialised(&p.small)))
        .push(Router::with_path("{one}/segment/literal").get(OneCapture(&p.small)))
        .push(Router::with_path("{one}/with-second/{two}").get(TwoCaptures(&p.small)))
}
