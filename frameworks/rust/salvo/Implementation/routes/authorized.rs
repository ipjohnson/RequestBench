use salvo::http::HeaderValue;
use salvo::http::header::AUTHORIZATION;
use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Serialised;

/// authorized: a bearer-token check hooped onto this one route. It compares the Authorization
/// header with one bearer token before the handler runs, and refuses any other value,
/// or none, with 403.
pub fn router(p: &'static Payloads) -> Router {
    let token = HeaderValue::from_static("Bearer 5a7cc77ed0dcb825806b6f872026c317");

    Router::with_path("/authorized/small").hoop(Bearer(token)).get(Serialised(&p.small))
}

// rb:handler authorized.denied
// rb:wiring authorized.*
/// Salvo's basic-auth and jwt-auth hoops refuse with 401, and neither compares a bearer token, so
/// this hoop is written by hand. It refuses with Salvo's own 403 StatusError and ends the flow
/// before the handler.
struct Bearer(HeaderValue);

#[handler]
impl Bearer {
    async fn handle(&self, req: &mut Request, res: &mut Response, ctrl: &mut FlowCtrl) {
        if req.headers().get(AUTHORIZATION) != Some(&self.0) {
            res.render(StatusError::forbidden());
            ctrl.skip_rest();
        }
    }
}
// rb:end
