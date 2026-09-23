use std::io::Cursor;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use cached::{Cached, LruTtlCache};
use rocket::http::{Header, Status};
use rocket::outcome::Outcome;
use rocket::route::{self, Handler, Route};
use rocket::serde::json::Json;
use rocket::{Build, Data, Request, Responder, Response, Rocket, State, get, routes};

use crate::Payloads;
use crate::payloads::{CacheSettings, Payload};
use crate::serial::Fresh;

/// An answer with the Vary header, which tells a cache in front of the framework what the answer
/// depends on. The store keys on the route's own list, not on this header.
#[derive(Responder)]
struct Varied<R> {
    inner: R,
    vary: Header<'static>,
}

fn varied<'a, R>(inner: R, on: impl Iterator<Item = &'a String>) -> Varied<R> {
    Varied { inner, vary: Header::new("Vary", on.map(String::as_str).collect::<Vec<_>>().join(", ")) }
}

/// cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial,
/// so a replayed answer repeats the serial it was stored with. A vary route's key adds its headers.
#[get("/cache/small")]
fn small(p: &State<Payloads>) -> Fresh<Json<&Payload>> {
    Fresh::new(Json(&p.small))
}

#[get("/cache/medium")]
fn medium(p: &State<Payloads>) -> Fresh<Json<&Payload>> {
    Fresh::new(Json(&p.medium))
}

#[get("/cache/large")]
fn large(p: &State<Payloads>) -> Fresh<Json<&Payload>> {
    Fresh::new(Json(&p.large))
}

#[get("/cache/vary/one")]
fn vary_one(p: &State<Payloads>) -> Fresh<Varied<Json<&Payload>>> {
    Fresh::new(varied(Json(&p.small), p.settings.cache.vary.one.keys()))
}

#[get("/cache/vary/many")]
fn vary_many(p: &State<Payloads>) -> Fresh<Varied<Json<&Payload>>> {
    Fresh::new(varied(Json(&p.small), p.settings.cache.vary.many.keys()))
}

pub fn stage(rocket: Rocket<Build>, p: &Payloads) -> Rocket<Build> {
    let settings = &p.settings.cache;
    let one: Vec<String> = settings.vary.one.keys().cloned().collect();
    let many: Vec<String> = settings.vary.many.keys().cloned().collect();
    rocket
        .mount("/", stored(routes![small, medium, large], &[], settings))
        .mount("/", stored(routes![vary_one], &one, settings))
        .mount("/", stored(routes![vary_many], &many, settings))
}

// rb:wiring cache.*
/// The path and the values of the request headers a route varies on.
type Key = (String, Vec<Option<String>>);

/// An answer as the store keeps it, to be written back as the handler wrote it.
struct Answer {
    status: Status,
    headers: Vec<Header<'static>>,
    body: Arc<[u8]>,
}

impl Answer {
    fn response<'r>(&self) -> Response<'r> {
        let mut response = Response::build();
        response.status(self.status);
        for header in &self.headers {
            response.header(header.clone());
        }
        response.sized_body(self.body.len(), Cursor::new(self.body.clone())).finalize()
    }
}

/// A store in front of one route. Rocket runs nothing around a handler but the handler itself,
/// and the handler the route attribute generates is a value an application may replace, so the
/// store is a Handler that wraps it. It answers from the store before that handler runs, and
/// stores a 200 the handler answers, with settings.json's capacity in entries and its time to live.
#[derive(Clone)]
struct Stored {
    route: Box<dyn Handler>,
    on: Arc<[String]>,
    store: Arc<Mutex<LruTtlCache<Key, Arc<Answer>>>>,
}

#[rocket::async_trait]
impl Handler for Stored {
    async fn handle<'r>(&self, request: &'r Request<'_>, data: Data<'r>) -> route::Outcome<'r> {
        let key = (request.uri().path().to_string(), self.on.iter().map(|name| request.headers().get_one(name).map(str::to_owned)).collect());
        let hit = self.store.lock().expect("the store is not poisoned").cache_get(&key).cloned();
        if let Some(answer) = hit {
            return Outcome::Success(answer.response());
        }
        let mut response = match self.route.handle(request, data).await {
            Outcome::Success(response) if response.status() == Status::Ok => response,
            outcome => return outcome,
        };
        let Ok(body) = response.body_mut().to_bytes().await else {
            return Outcome::Error(Status::InternalServerError);
        };
        let headers = response.headers().iter().map(|h| Header::new(h.name().to_string(), h.value().to_string())).collect();
        let answer = Arc::new(Answer { status: response.status(), headers, body: body.into() });
        response.set_sized_body(answer.body.len(), Cursor::new(answer.body.clone()));
        self.store.lock().expect("the store is not poisoned").cache_set(key, answer);
        Outcome::Success(response)
    }
}

/// Each route's handler wrapped in a store of its own.
fn stored(routes: Vec<Route>, on: &[String], settings: &CacheSettings) -> Vec<Route> {
    let wrap = |mut route: Route| {
        let store = LruTtlCache::new(settings.capacity, Duration::from_secs(settings.ttl_seconds));
        route.handler = Box::new(Stored { route: route.handler.clone(), on: on.into(), store: Arc::new(Mutex::new(store)) });
        route
    };
    routes.into_iter().map(wrap).collect()
}
// rb:end
