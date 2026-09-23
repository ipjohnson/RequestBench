use salvo::http::ParseResult;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Serialised};
use crate::payloads::Payload;

/// Read by header name and echoed by field name.
#[derive(Deserialize, Serialize)]
#[serde(rename_all(serialize = "camelCase"))]
struct Bound {
    #[serde(rename(deserialize = "x-rb-tenant"))]
    tenant: String,
    #[serde(rename(deserialize = "x-rb-request-id"))]
    request_id: String,
    #[serde(rename(deserialize = "x-rb-account"))]
    account: i64,
}

// rb:handler headers.bind_few,headers.bind_many
/// The three headers bound into a struct by Salvo's parse_headers, the account as an integer. A
/// header that is missing or that does not convert is Salvo's ParseError, which it answers with
/// 400.
#[derive(Clone, Copy)]
struct Bind(&'static Payload);

#[handler]
impl Bind {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, Bound>>> {
        Ok(Json(Echoed::new(self.0, req.parse_headers::<Bound>()?)))
    }
}
// rb:end

/// headers: /headers reads no header, and /headers/bind reads three.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/headers")
        .get(Serialised(&p.small))
        .push(Router::with_path("bind").get(Bind(&p.small)))
}
