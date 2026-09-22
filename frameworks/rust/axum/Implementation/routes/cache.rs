use std::time::Duration;

use axum::body::Body;
use axum::http::header::VARY;
use axum::http::{HeaderName, HeaderValue, Request, Uri};
use axum::routing::get;
use axum::{Json, Router};
use axum_response_cache::{CacheLayer, CachedResponse, Keyer};
use cached::LruTtlCache;

use crate::Payloads;
use crate::payloads::CacheSettings;
use crate::serial;

/// The path and the values of the request headers a route varies on.
type Key = (Uri, Vec<Option<HeaderValue>>);

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn router(p: &'static Payloads) -> Router {
    let settings = &p.settings.cache;
    let one = names(settings.vary.one.keys());
    let many = names(settings.vary.many.keys());
    let vary_one = listed(&one);
    let vary_many = listed(&many);

    Router::new()
        .route("/cache/small", get(move || async move { (serial::fresh(), Json(&p.small)) }).layer(stored(settings, vec![])))
        .route("/cache/medium", get(move || async move { (serial::fresh(), Json(&p.medium)) }).layer(stored(settings, vec![])))
        .route("/cache/large", get(move || async move { (serial::fresh(), Json(&p.large)) }).layer(stored(settings, vec![])))
        // The Vary header tells a cache in front of the framework what the answer depends on. The
        // store keys on the route's own list, not on this header.
        .route("/cache/vary/one", get(move || async move { (serial::fresh(), [(VARY, vary_one)], Json(&p.small)) }).layer(stored(settings, one)))
        .route("/cache/vary/many", get(move || async move { (serial::fresh(), [(VARY, vary_many)], Json(&p.small)) }).layer(stored(settings, many)))
}

// rb:wiring cache.*
/// axum-response-cache's layer in front of one route. It answers from its store before the handler
/// runs, and stores a 2xx the handler answers, with settings.json's capacity in entries and its
/// time to live.
fn stored(settings: &CacheSettings, on: Vec<HeaderName>) -> CacheLayer<LruTtlCache<Key, CachedResponse>, impl Keyer<Key = Key>> {
    let keyer = move |request: &Request<Body>| -> Key {
        (request.uri().clone(), on.iter().map(|name| request.headers().get(name).cloned()).collect())
    };
    let store = LruTtlCache::with_size_and_ttl(settings.capacity, Duration::from_secs(settings.ttl_seconds));
    CacheLayer::with_cache_and_keyer(store, keyer)
}
// rb:end

fn names<'a>(keys: impl Iterator<Item = &'a String>) -> Vec<HeaderName> {
    keys.map(|key| HeaderName::from_bytes(key.as_bytes()).expect("settings.json's vary keys are header names")).collect()
}

fn listed(names: &[HeaderName]) -> HeaderValue {
    let joined = names.iter().map(HeaderName::as_str).collect::<Vec<_>>().join(", ");
    HeaderValue::from_str(&joined).expect("header names joined by commas are a header value")
}
