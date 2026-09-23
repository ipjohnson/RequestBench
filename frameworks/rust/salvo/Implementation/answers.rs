use salvo::prelude::*;
use serde::{Deserialize, Serialize};

use crate::payloads::{Item, Payload};
use crate::serial;

// rb:handler json.small,json.medium,json.large,middleware.none,middleware.four,middleware.sixteen,parameters.static,headers.few,headers.many,authorized.allowed,cors.scoped
/// A payload the process already holds, written by Salvo's Json writer. Salvo takes a handler as
/// a function or a struct, never a closure, so the routes hand each one the payload it answers.
#[derive(Clone, Copy)]
pub struct Serialised(pub &'static Payload);

#[handler]
impl Serialised {
    async fn handle(&self) -> Json<&'static Payload> {
        Json(self.0)
    }
}
// rb:end

// rb:handler cache.small,cache.medium,cache.large,cache.vary_one,cache.vary_many,compressed.gzip_small,compressed.gzip_large,compressed.identity_small,compressed.identity_large,etag.small,etag.large,etag.match_large,etag.stale_large,cors.request,cors.vary
/// A payload written with the next x-rb-serial, so an answer shows whether this handler ran for
/// it or a hoop in front of it answered.
#[derive(Clone, Copy)]
pub struct Stamped(pub &'static Payload);

#[handler]
impl Stamped {
    async fn handle(&self, res: &mut Response) {
        serial::stamp(res);
        res.render(Json(self.0));
    }
}
// rb:end

/// A payload with the values a handler bound written back beside its own fields.
#[derive(Serialize)]
pub struct Echoed<'a, T> {
    size: &'a str,
    count: i64,
    items: &'a [Item],
    echo: T,
}

impl<'a, T> Echoed<'a, T> {
    pub fn new(payload: &'a Payload, echo: T) -> Self {
        Echoed { size: &payload.size, count: payload.count, items: &payload.items, echo }
    }
}

/// query.many's eight values, which forms.urlencoded posts as a form.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Search {
    page: i64,
    size: i64,
    status: String,
    category: String,
    sort: String,
    q: String,
    min_price: i64,
    max_price: i64,
}
