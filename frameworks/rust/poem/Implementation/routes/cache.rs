use std::sync::{Arc, Mutex};
use std::time::Duration;

use bytes::Bytes;
use cached::{Cached, LruTtlCache};
use poem::endpoint::make_sync;
use poem::http::header::VARY;
use poem::http::{HeaderMap, HeaderName, HeaderValue, StatusCode, Uri};
use poem::web::Json;
use poem::{Endpoint, EndpointExt, IntoResponse, Middleware, Request, Response, Result, Route, get};

use crate::payloads::CacheSettings;
use crate::{Payloads, serial};

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    let settings = &p.settings.cache;
    let one = names(settings.vary.one.keys());
    let many = names(settings.vary.many.keys());
    let vary_one = listed(&one);
    let vary_many = listed(&many);

    route
        .at("/cache/small", get(make_sync(move |_| serial::fresh(Json(&p.small)))).with(Stored::new(settings, vec![])))
        .at("/cache/medium", get(make_sync(move |_| serial::fresh(Json(&p.medium)))).with(Stored::new(settings, vec![])))
        .at("/cache/large", get(make_sync(move |_| serial::fresh(Json(&p.large)))).with(Stored::new(settings, vec![])))
        // The Vary header tells a cache in front of the framework what the answer depends on. The
        // store keys on the route's own list, not on this header.
        .at("/cache/vary/one", get(make_sync(move |_| serial::fresh(Json(&p.small)).with_header(VARY, vary_one.clone()))).with(Stored::new(settings, one)))
        .at("/cache/vary/many", get(make_sync(move |_| serial::fresh(Json(&p.small)).with_header(VARY, vary_many.clone()))).with(Stored::new(settings, many)))
}

// rb:wiring cache.*
/// The path and the values of the request headers a route varies on.
type Key = (Uri, Vec<Option<HeaderValue>>);

/// An answer as the store keeps it.
#[derive(Clone)]
struct Kept {
    status: StatusCode,
    headers: HeaderMap,
    body: Bytes,
}

impl Kept {
    fn answer(&self) -> Response {
        let mut answer = Response::builder().status(self.status).body(self.body.clone());
        *answer.headers_mut() = self.headers.clone();
        answer
    }
}

/// A poem Middleware in front of one route, because poem ships no response cache. It answers from
/// its store before the handler runs, and stores a 2xx the handler answers, in cached's LruTtlCache
/// with settings.json's capacity in entries and its time to live, the store axum-response-cache
/// keeps for axum.
struct Stored {
    on: Arc<[HeaderName]>,
    store: Arc<Mutex<LruTtlCache<Key, Kept>>>,
}

impl Stored {
    fn new(settings: &CacheSettings, on: Vec<HeaderName>) -> Stored {
        let store = LruTtlCache::new(settings.capacity, Duration::from_secs(settings.ttl_seconds));
        Stored { on: on.into(), store: Arc::new(Mutex::new(store)) }
    }
}

impl<E: Endpoint> Middleware<E> for Stored {
    type Output = StoredEndpoint<E>;

    fn transform(&self, ep: E) -> StoredEndpoint<E> {
        StoredEndpoint { ep, on: self.on.clone(), store: self.store.clone() }
    }
}

struct StoredEndpoint<E> {
    ep: E,
    on: Arc<[HeaderName]>,
    store: Arc<Mutex<LruTtlCache<Key, Kept>>>,
}

impl<E: Endpoint> Endpoint for StoredEndpoint<E> {
    type Output = Response;

    async fn call(&self, req: Request) -> Result<Response> {
        let key: Key = (req.uri().clone(), self.on.iter().map(|name| req.headers().get(name).cloned()).collect());
        if let Some(kept) = self.store.lock().expect("the store is not poisoned").cache_get(&key) {
            return Ok(kept.answer());
        }
        let answer = self.ep.call(req).await?.into_response();
        if !answer.status().is_success() {
            return Ok(answer);
        }
        let (parts, body) = answer.into_parts();
        let kept = Kept { status: parts.status, headers: parts.headers, body: body.into_bytes().await? };
        let answer = kept.answer();
        self.store.lock().expect("the store is not poisoned").cache_set(key, kept);
        Ok(answer)
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
