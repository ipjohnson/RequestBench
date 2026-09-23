use std::sync::{Arc, Mutex};
use std::time::Duration;

use bytes::Bytes;
use cached::{Cached, LruTtlCache};
use http_body_util::BodyExt;
use warp::filters::BoxedFilter;
use warp::http::header::VARY;
use warp::http::{HeaderMap, HeaderValue, StatusCode};
use warp::reply::Response;
use warp::{Filter, Rejection, Reply};

use crate::payloads::CacheSettings;
use crate::{Payloads, Routes, serial};

/// The values of the request headers a route varies on. Each route has a store of its own, so the
/// path is not part of the key.
type Key = Vec<Option<HeaderValue>>;

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn routes(p: &'static Payloads) -> Routes {
    let settings = &p.settings.cache;
    let on_one: Vec<&'static str> = settings.vary.one.keys().map(String::as_str).collect();
    let on_many: Vec<&'static str> = settings.vary.many.keys().map(String::as_str).collect();
    let (vary_one, vary_many) = (listed(&on_one), listed(&on_many));

    // rb:handler cache.small
    let small = stored(settings, &[], warp::path!("cache" / "small").and(warp::get()), move || serial::fresh(warp::reply::json(&p.small)));
    // rb:handler cache.medium
    let medium = stored(settings, &[], warp::path!("cache" / "medium").and(warp::get()), move || serial::fresh(warp::reply::json(&p.medium)));
    // rb:handler cache.large
    let large = stored(settings, &[], warp::path!("cache" / "large").and(warp::get()), move || serial::fresh(warp::reply::json(&p.large)));
    // The Vary header tells a cache in front of the framework what the answer depends on. The
    // store keys on the route's own list, not on this header.
    // rb:handler cache.vary_one
    let one = stored(settings, &on_one, warp::path!("cache" / "vary" / "one").and(warp::get()), move || warp::reply::with_header(serial::fresh(warp::reply::json(&p.small)), VARY, vary_one.clone()));
    // rb:handler cache.vary_many
    let many = stored(settings, &on_many, warp::path!("cache" / "vary" / "many").and(warp::get()), move || warp::reply::with_header(serial::fresh(warp::reply::json(&p.small)), VARY, vary_many.clone()));
    small.or(medium).unify().or(large).unify().or(one).unify().or(many).unify().boxed()
}

// rb:wiring cache.*
/// An answer as the store keeps it.
#[derive(Clone)]
struct Stored {
    status: StatusCode,
    headers: HeaderMap,
    body: Bytes,
}

/// A store in front of one route's handler, which warp does not have, over the store
/// axum-response-cache keeps: an LRU with a time to live, holding settings.json's capacity in
/// entries. Once the route's path and method pass, it answers from the store before the handler
/// runs, and stores a 2xx the handler answers.
fn stored<P, H, R>(settings: &CacheSettings, on: &[&'static str], route: P, handler: H) -> Routes
where
    P: Filter<Extract = (), Error = Rejection> + Clone + Send + Sync + 'static,
    H: Fn() -> R + Clone + Send + Sync + 'static,
    R: Reply,
{
    let store = Arc::new(Mutex::new(LruTtlCache::<Key, Stored>::new(settings.capacity, Duration::from_secs(settings.ttl_seconds))));
    route
        .and(key(on))
        .and_then(move |key: Key| {
            let (store, handler) = (store.clone(), handler.clone());
            async move {
                if let Some(hit) = store.lock().expect("no thread panicked holding the store").cache_get(&key).cloned() {
                    return Ok::<_, Rejection>(replayed(hit));
                }
                let (parts, body) = handler().into_response().into_parts();
                let Ok(collected) = body.collect().await else {
                    return Ok(StatusCode::INTERNAL_SERVER_ERROR.into_response());
                };
                let body = collected.to_bytes();
                if parts.status.is_success() {
                    let kept = Stored { status: parts.status, headers: parts.headers.clone(), body: body.clone() };
                    store.lock().expect("no thread panicked holding the store").cache_set(key, kept);
                }
                Ok(Response::from_parts(parts, body.into()))
            }
        })
        .boxed()
}

/// The values of the headers a route varies on, in the order settings.json lists them. A route
/// that varies on none reads no header.
fn key(on: &[&'static str]) -> BoxedFilter<(Key,)> {
    if on.is_empty() {
        return warp::any().map(Vec::new).boxed();
    }
    let on: Arc<[&'static str]> = on.into();
    warp::header::headers_cloned().map(move |headers: HeaderMap| on.iter().map(|name| headers.get(*name).cloned()).collect()).boxed()
}

fn listed(names: &[&str]) -> HeaderValue {
    HeaderValue::from_str(&names.join(", ")).expect("header names joined by commas are a header value")
}

fn replayed(hit: Stored) -> Response {
    let mut response = Response::new(hit.body.into());
    *response.status_mut() = hit.status;
    *response.headers_mut() = hit.headers;
    response
}
// rb:end
