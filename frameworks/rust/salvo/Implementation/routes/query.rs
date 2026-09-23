use salvo::http::ParseResult;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Payloads;
use crate::answers::{Echoed, Search};
use crate::payloads::Payload;

#[derive(Deserialize, Serialize)]
struct Page {
    page: i64,
}

// rb:handler query.one
/// One value bound by Salvo's parse_queries, where the field names and types are the binding.
#[derive(Clone, Copy)]
struct OneValue(&'static Payload);

#[handler]
impl OneValue {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, Page>>> {
        Ok(Json(Echoed::new(self.0, req.parse_queries::<Page>()?)))
    }
}
// rb:end

// rb:handler query.many
#[derive(Clone, Copy)]
struct ManyValues(&'static Payload);

#[handler]
impl ManyValues {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, Search>>> {
        Ok(Json(Echoed::new(self.0, req.parse_queries::<Search>()?)))
    }
}
// rb:end

/// query: the query string bound into a struct by Salvo's parse_queries.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/query")
        .push(Router::with_path("one").get(OneValue(&p.small)))
        .push(Router::with_path("many").get(ManyValues(&p.small)))
}
