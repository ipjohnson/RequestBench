use std::sync::{Arc, Mutex};

use actix_web::body::{MessageBody, to_bytes};
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::error::ErrorInternalServerError;
use actix_web::http::header::{HeaderMap, HeaderName, HeaderValue, VARY};
use actix_web::http::{StatusCode, Uri};
use actix_web::middleware::{Next, from_fn};
use actix_web::web::{self, Bytes, ServiceConfig};
use actix_web::{Error, HttpResponse};
use cached::{Cached, LruTtlCache};

use crate::Payloads;
use crate::payloads::CacheSettings;
use crate::serial;

/// The path and the values of the request headers a route varies on.
type Key = (Uri, Vec<Option<HeaderValue>>);

// rb:wiring cache.*
/// An answer as a store keeps it.
#[derive(Clone)]
struct Stored {
    status: StatusCode,
    headers: HeaderMap,
    body: Bytes,
}

/// One route's store, with the request headers the route varies on. HttpServer builds an App per
/// worker thread, and every one of them holds the same store through the Arc. It holds
/// settings.json's capacity in entries, each for settings.json's time to live.
#[derive(Clone)]
pub struct Store {
    entries: Arc<Mutex<LruTtlCache<Key, Stored>>>,
    on: Arc<[HeaderName]>,
}

impl Store {
    fn new(settings: &CacheSettings, on: Vec<HeaderName>) -> Store {
        let entries = LruTtlCache::builder().max_size(settings.capacity).ttl_secs(settings.ttl_seconds).build();
        Store { entries: Arc::new(Mutex::new(entries.expect("settings.json's cache has a capacity and a time to live"))), on: on.into() }
    }

    fn key(&self, request: &ServiceRequest) -> Key {
        (request.uri().clone(), self.on.iter().map(|name| request.headers().get(name).cloned()).collect())
    }
}

/// actix-web ships no response cache, so this middleware is written by hand and wrapped around
/// each cache route's resource. It answers from the route's store before the handler runs, and
/// stores a 2xx the handler answers.
async fn replay(store: Store, request: ServiceRequest, next: Next<impl MessageBody + 'static>) -> Result<ServiceResponse, Error> {
    let key = store.key(&request);
    let hit = store.entries.lock().expect("no thread panicked holding the store").cache_get(&key).cloned();
    if let Some(stored) = hit {
        let mut answer = HttpResponse::build(stored.status);
        for (name, value) in &stored.headers {
            answer.append_header((name.clone(), value.clone()));
        }
        return Ok(request.into_response(answer.body(stored.body)));
    }
    let (request, answer) = next.call(request).await?.into_parts();
    let (answer, body) = answer.into_parts();
    let body = to_bytes(body).await.map_err(|e| ErrorInternalServerError(e.into() as Box<dyn std::error::Error>))?;
    if answer.status().is_success() {
        let stored = Stored { status: answer.status(), headers: answer.headers().clone(), body: body.clone() };
        store.entries.lock().expect("no thread panicked holding the store").cache_set(key, stored);
    }
    Ok(ServiceResponse::new(request, answer.set_body(body).map_into_boxed_body()))
}
// rb:end

/// The five cache routes' stores, made once for the process.
#[derive(Clone)]
pub struct Stores {
    small: Store,
    medium: Store,
    large: Store,
    vary_one: Store,
    vary_many: Store,
}

impl Stores {
    pub fn new(settings: &CacheSettings) -> Stores {
        Stores {
            small: Store::new(settings, vec![]),
            medium: Store::new(settings, vec![]),
            large: Store::new(settings, vec![]),
            vary_one: Store::new(settings, names(settings.vary.one.keys())),
            vary_many: Store::new(settings, names(settings.vary.many.keys())),
        }
    }
}

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial, so
/// a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads, stores: &Stores) {
    let Stores { small, medium, large, vary_one: one, vary_many: many } = stores.clone();
    // The Vary header tells a cache in front of the framework what the answer depends on. The store
    // keys on the route's own list, not on this header.
    let (vary_one, vary_many) = (listed(&one.on), listed(&many.on));

    cfg.service(web::resource("/cache/small").route(web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.small) })).wrap(from_fn(move |request, next| replay(small.clone(), request, next))))
        .service(web::resource("/cache/medium").route(web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.medium) })).wrap(from_fn(move |request, next| replay(medium.clone(), request, next))))
        .service(web::resource("/cache/large").route(web::get().to(move || async move { HttpResponse::Ok().insert_header(serial::fresh()).json(&p.large) })).wrap(from_fn(move |request, next| replay(large.clone(), request, next))))
        .service(web::resource("/cache/vary/one").route(web::get().to(move || { let vary = vary_one.clone(); async move { HttpResponse::Ok().insert_header(serial::fresh()).insert_header((VARY, vary)).json(&p.small) } })).wrap(from_fn(move |request, next| replay(one.clone(), request, next))))
        .service(web::resource("/cache/vary/many").route(web::get().to(move || { let vary = vary_many.clone(); async move { HttpResponse::Ok().insert_header(serial::fresh()).insert_header((VARY, vary)).json(&p.small) } })).wrap(from_fn(move |request, next| replay(many.clone(), request, next))));
}

fn names<'a>(keys: impl Iterator<Item = &'a String>) -> Vec<HeaderName> {
    keys.map(|key| HeaderName::from_bytes(key.as_bytes()).expect("settings.json's vary keys are header names")).collect()
}

fn listed(names: &[HeaderName]) -> HeaderValue {
    let joined = names.iter().map(HeaderName::as_str).collect::<Vec<_>>().join(", ");
    HeaderValue::from_str(&joined).expect("header names joined by commas are a header value")
}
