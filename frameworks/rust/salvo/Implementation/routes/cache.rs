use std::time::Duration;

use salvo::cache::{Cache, CacheIssuer, MokaStore, RequestIssuer};
use salvo::http::HeaderValue;
use salvo::http::header::{HeaderName, VARY};
use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Stamped;

/// Room for the cache family's 52 keys.
const CAPACITY: u64 = 64;

/// How long a stored answer is replayed.
const LIFETIME: Duration = Duration::from_secs(30);

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn router(p: &'static Payloads) -> Router {
    let one = vec![HeaderName::from_static("x-rb-tenant")];
    let many = vec![HeaderName::from_static("x-rb-channel"), HeaderName::from_static("x-rb-region"), HeaderName::from_static("x-rb-tenant")];

    Router::with_path("/cache")
        .push(Router::with_path("small/{key}").hoop(stored(RequestIssuer::default())).get(Stamped(&p.small)))
        .push(Router::with_path("medium/{key}").hoop(stored(RequestIssuer::default())).get(Stamped(&p.medium)))
        .push(Router::with_path("large/{key}").hoop(stored(RequestIssuer::default())).get(Stamped(&p.large)))
        // Varies is hooped outside the cache, so it writes Vary after the cache has stored or
        // replayed the answer.
        .push(Router::with_path("vary/one/{key}").hoop(Varies(listed(&one))).hoop(stored(KeyedBy(one))).get(Stamped(&p.small)))
        .push(Router::with_path("vary/many/{key}").hoop(Varies(listed(&many))).hoop(stored(KeyedBy(many))).get(Stamped(&p.small)))
}

// rb:wiring cache.*
/// salvo-cache's hoop in front of one route. It answers from its store before the handler runs,
/// and stores a 2xx the handler answers, with CAPACITY entries, each for LIFETIME. The issuer makes the key.
fn stored<I: CacheIssuer>(issuer: I) -> Cache<MokaStore<I::Key>, I>
where
    I::Key: Clone,
{
    let store = MokaStore::builder().max_capacity(CAPACITY).time_to_live(LIFETIME).build();
    Cache::new(store, issuer)
}

/// Salvo's own key, from the request's path and method, with the values of the headers a vary
/// route varies on.
struct KeyedBy(Vec<HeaderName>);

impl CacheIssuer for KeyedBy {
    type Key = (String, Vec<Option<HeaderValue>>);

    async fn issue(&self, req: &mut Request, depot: &Depot) -> Option<Self::Key> {
        let request = RequestIssuer::default().issue(req, depot).await?;
        Some((request, self.0.iter().map(|name| req.headers().get(name).cloned()).collect()))
    }
}

/// salvo-cache stores no answer that carries Vary, because its store does not compare the headers
/// Vary names when it looks an answer up. KeyedBy puts those headers in the key instead, and this
/// hoop writes Vary once the cache has stored the answer or replayed it, so a cache in front of the
/// framework still learns what the answer depends on.
struct Varies(HeaderValue);

#[handler]
impl Varies {
    async fn handle(&self, req: &mut Request, depot: &mut Depot, res: &mut Response, ctrl: &mut FlowCtrl) {
        ctrl.call_next(req, depot, res).await;
        res.headers_mut().insert(VARY, self.0.clone());
    }
}
// rb:end


fn listed(names: &[HeaderName]) -> HeaderValue {
    let joined = names.iter().map(HeaderName::as_str).collect::<Vec<_>>().join(", ");
    HeaderValue::from_str(&joined).expect("header names joined by commas are a header value")
}
