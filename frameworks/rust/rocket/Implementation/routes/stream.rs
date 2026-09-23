use rocket::futures::stream::{self, Stream, StreamExt};
use rocket::http::ContentType;
use rocket::response::stream::ByteStream;
use rocket::{Build, Rocket, State, get, routes};

use crate::Payloads;

/// stream: items.medium's rows written one per line, each line an item of Rocket's ByteStream.
/// The body is a stream, so its length is never known and the answer goes out chunked.
#[get("/stream/items")]
fn items(p: &State<Payloads>) -> (ContentType, ByteStream<impl Stream<Item = Vec<u8>> + '_>) {
    let lines = stream::iter(&p.medium.items).map(|row| {
        let mut line = serde_json::to_vec(row).expect("a row serialises");
        line.push(b'\n');
        line
    });
    (ContentType::new("application", "x-ndjson"), ByteStream::from(lines))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![items])
}
