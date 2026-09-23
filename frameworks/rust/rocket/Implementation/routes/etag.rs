use entity_tag::EntityTag;
use rocket::http::Header;
use rocket::response::content::RawJson;
use rocket::{Build, Responder, Rocket, State, get, routes};
use rocket_etag_if_none_match::EtagIfNoneMatch;

use crate::Payloads;
use crate::payloads::Payload;
use crate::serial;

// rb:wiring etag.*
/// An answer or its 304, as rocket-etag-if-none-match's documentation writes the pair. Rocket
/// computes no validator for an answer a handler builds; the crate's guard reads If-None-Match and
/// compares it weakly, and the tag is entity-tag's XXH3 hash of the body.
#[derive(Responder)]
enum Revalidated {
    Fresh(RawJson<Vec<u8>>, Header<'static>, Header<'static>),
    #[response(status = 304)]
    NotModified((), Header<'static>, Header<'static>),
}

/// The body is serialised and hashed before anything is compared, so a 304 saves the write and
/// nothing else.
fn revalidated(asked: &EtagIfNoneMatch<'_>, payload: &Payload) -> Revalidated {
    let body = serde_json::to_vec(payload).expect("a payload serialises");
    let tag = EntityTag::from_data(&body);
    let etag = Header::new(EntityTag::HEADER_NAME, tag.to_string());
    if asked.weak_eq(&tag) { Revalidated::NotModified((), etag, serial::next()) } else { Revalidated::Fresh(RawJson(body), etag, serial::next()) }
}
// rb:end

/// etag: the handler hashes what it answers and answers 304 when If-None-Match already names it.
#[get("/etag/small")]
fn small(asked: EtagIfNoneMatch<'_>, p: &State<Payloads>) -> Revalidated {
    revalidated(&asked, &p.small)
}

#[get("/etag/large")]
fn large(asked: EtagIfNoneMatch<'_>, p: &State<Payloads>) -> Revalidated {
    revalidated(&asked, &p.large)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![small, large])
}
