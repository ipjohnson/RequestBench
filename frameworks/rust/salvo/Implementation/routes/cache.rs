use std::time::Duration;

use salvo::cache::{Cache, CacheIssuer, MokaStore, RequestIssuer};
use salvo::http::HeaderValue;
use salvo::http::header::{HeaderName, VARY};
use salvo::prelude::*;

use crate::Payloads;
use crate::answers::Stamped;
use crate::payloads::CacheSettings;

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn router(p: &'static Payloads) -> Router {
    let settings = &p.settings.cache;
    let one = names(settings.vary.one.keys());
    let many = names(settings.vary.many.keys());

    Router::with_path("/cache")
        .push(Router::with_path("small").hoop(stored(settings, RequestIssuer::default())).get(Stamped(&p.small)))
        .push(Router::with_path("medium").hoop(stored(settings, RequestIssuer::default())).get(Stamped(&p.medium)))
        .push(Router::with_path("large").hoop(stored(settings, RequestIssuer::default())).get(Stamped(&p.large)))
        // Varies is hooped outside the cache, so it writes Vary after the cache has stored or
        // replayed the answer.
        .push(Router::with_path("vary/one").hoop(Varies(listed(&one))).hoop(stored(settings, KeyedBy(one))).get(Stamped(&p.small)))
        .push(Router::with_path("vary/many").hoop(Varies(listed(&many))).hoop(stored(settings, KeyedBy(many))).get(Stamped(&p.small)))
}

// rb:wiring cache.*
/// salvo-cache's hoop in front of one route. It answers from its store before the handler runs,
/// and stores a 2xx the handler answers, with settings.json's capacity in entries and its time to
/// live. The issuer makes the key.
fn stored<I: CacheIssuer>(settings: &CacheSettings, issuer: I) -> Cache<MokaStore<I::Key>, I>
where
    I::Key: Clone,
{
    let store = MokaStore::builder().max_capacity(settings.capacity as u64).time_to_live(Duration::from_secs(settings.ttl_seconds)).build();
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

fn names<'a>(keys: impl Iterator<Item = &'a String>) -> Vec<HeaderName> {
    keys.map(|key| HeaderName::from_bytes(key.as_bytes()).expect("settings.json's vary keys are header names")).collect()
}

fn listed(names: &[HeaderName]) -> HeaderValue {
    let joined = names.iter().map(HeaderName::as_str).collect::<Vec<_>>().join(", ");
    HeaderValue::from_str(&joined).expect("header names joined by commas are a header value")
}
