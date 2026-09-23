use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::{Body, Bytes, to_bytes};
use axum::extract::{Request, State};
use axum::http::header::VARY;
use axum::http::response::Parts;
use axum::http::{HeaderName, HeaderValue, StatusCode, Uri};
use axum::middleware::{Next, from_fn_with_state};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use cached::{Cached, LruTtlCache};

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
        .route("/cache/small", get(move || async move { (serial::fresh(), Json(&p.small)) }).layer(from_fn_with_state(store(settings, vec![]), replay)))
        .route("/cache/medium", get(move || async move { (serial::fresh(), Json(&p.medium)) }).layer(from_fn_with_state(store(settings, vec![]), replay)))
        .route("/cache/large", get(move || async move { (serial::fresh(), Json(&p.large)) }).layer(from_fn_with_state(store(settings, vec![]), replay)))
        // The Vary header tells a cache in front of the framework what the answer depends on. The
        // store keys on the route's own list, not on this header.
        .route("/cache/vary/one", get(move || async move { (serial::fresh(), [(VARY, vary_one)], Json(&p.small)) }).layer(from_fn_with_state(store(settings, one), replay)))
        .route("/cache/vary/many", get(move || async move { (serial::fresh(), [(VARY, vary_many)], Json(&p.small)) }).layer(from_fn_with_state(store(settings, many), replay)))
}

// rb:wiring cache.*
/// An answer as the store keeps it.
#[derive(Clone)]
struct Stored {
    parts: Parts,
    body: Bytes,
}

/// One route's store: cached's LruTtlCache, holding settings.json's capacity in entries for its time
/// to live, and the headers the route varies on.
#[derive(Clone)]
struct Store {
    entries: Arc<Mutex<LruTtlCache<Key, Stored>>>,
    on: Arc<[HeaderName]>,
}

fn store(settings: &CacheSettings, on: Vec<HeaderName>) -> Store {
    let entries = LruTtlCache::new(settings.capacity, Duration::from_secs(settings.ttl_seconds));
    Store { entries: Arc::new(Mutex::new(entries)), on: on.into() }
}

/// A from_fn layer in front of one route, because axum ships no response cache. It answers from the
/// store before the handler runs, and stores a 2xx the handler answers.
async fn replay(State(store): State<Store>, request: Request, next: Next) -> Response {
    let key: Key = (request.uri().clone(), store.on.iter().map(|name| request.headers().get(name).cloned()).collect());
    let hit = store.entries.lock().expect("no thread panicked holding the store").cache_get(&key).cloned();
    if let Some(hit) = hit {
        return Response::from_parts(hit.parts, Body::from(hit.body));
    }
    let response = next.run(request).await;
    if !response.status().is_success() {
        return response;
    }
    let (parts, body) = response.into_parts();
    let Ok(body) = to_bytes(body, usize::MAX).await else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let kept = Stored { parts: parts.clone(), body: body.clone() };
    store.entries.lock().expect("no thread panicked holding the store").cache_set(key, kept);
    Response::from_parts(parts, Body::from(body))
}
// rb:end

fn names<'a>(keys: impl Iterator<Item = &'a String>) -> Vec<HeaderName> {
    keys.map(|key| HeaderName::from_bytes(key.as_bytes()).expect("settings.json's vary keys are header names")).collect()
}

fn listed(names: &[HeaderName]) -> HeaderValue {
    let joined = names.iter().map(HeaderName::as_str).collect::<Vec<_>>().join(", ");
    HeaderValue::from_str(&joined).expect("header names joined by commas are a header value")
}
