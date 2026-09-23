use rocket::futures::stream::{self, Stream, StreamExt};
use rocket::response::stream::{Event, EventStream};
use rocket::{Build, Rocket, State, get, routes};

use crate::Payloads;

/// sse: items.medium's rows through Rocket's own EventStream, which writes each row serde_json
/// serialises as the data of one event, with a heartbeat comment every 30 seconds.
#[get("/sse/medium")]
fn medium(p: &State<Payloads>) -> EventStream<impl Stream<Item = Event> + '_> {
    EventStream::from(stream::iter(&p.medium.items).map(Event::json))
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![medium])
}
