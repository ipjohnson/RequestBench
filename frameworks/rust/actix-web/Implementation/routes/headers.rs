use actix_web::HttpMessage;
use actix_web::error::ParseError;
use actix_web::http::header::{self, Header, HeaderName, HeaderValue, InvalidHeaderValue, TryIntoHeaderValue};
use actix_web::web::{self, ServiceConfig};
use serde::Serialize;

use crate::Payloads;
use crate::answers::Echoed;

// rb:wiring headers.*
/// A request header actix-web's Header extractor binds, by its name and its type. A header of the
/// application's own implements both halves of actix-web's Header trait: the parse the extractor
/// runs, through the value's FromStr, and the value a response would write.
macro_rules! bound_header {
    ($name:ident, $header:literal, $value:ty) => {
        struct $name($value);

        impl TryIntoHeaderValue for $name {
            type Error = InvalidHeaderValue;

            fn try_into_value(self) -> Result<HeaderValue, Self::Error> {
                HeaderValue::from_str(&self.0.to_string())
            }
        }

        impl Header for $name {
            fn name() -> HeaderName {
                HeaderName::from_static($header)
            }

            fn parse<M: HttpMessage>(message: &M) -> Result<Self, ParseError> {
                header::from_one_raw_str(message.headers().get(Self::name())).map($name)
            }
        }
    };
}

bound_header!(Tenant, "x-rb-tenant", String);
bound_header!(RequestId, "x-rb-request-id", String);
bound_header!(Account, "x-rb-account", i64);
// rb:end

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bound {
    tenant: String,
    request_id: String,
    account: i64,
}

/// headers: /headers reads no header, and /headers/bind binds three through actix-web's Header
/// extractor, the account as an integer. A header that is missing or does not parse is refused by
/// the extractor with 400.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/headers", web::get().to(move || async move { web::Json(&p.small) }))
        .route("/headers/bind", web::get().to(move |tenant: web::Header<Tenant>, request_id: web::Header<RequestId>, account: web::Header<Account>| async move {
            let bound = Bound { tenant: tenant.into_inner().0, request_id: request_id.into_inner().0, account: account.into_inner().0 };
            web::Json(Echoed::new(&p.small, bound))
        }));
}
