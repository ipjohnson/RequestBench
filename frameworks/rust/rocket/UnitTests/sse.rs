use rocket::http::{Accept, Status};
use serde_json::Value;

use crate::support::{client, expected, text};

/// The data of each event, with comments, such as Rocket's heartbeat, left out.
fn events(stream: &str) -> Vec<Value> {
    stream
        .split("\n\n")
        .filter_map(|event| {
            let data: Vec<&str> = event.lines().filter_map(|line| line.strip_prefix("data:")).map(|d| d.strip_prefix(' ').unwrap_or(d)).collect();
            (!data.is_empty()).then(|| serde_json::from_str(&data.join("\n")).unwrap())
        })
        .collect()
}

// rb:test sse.medium
/// sse.medium: items.medium's rows, each the data of one event, with no length.
#[test]
fn each_row_is_one_event() {
    let client = client();

    let response = client.get("/sse/medium").header(Accept::EventStream).dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.content_type().map(|t| t.to_string()).as_deref(), Some("text/event-stream"));
    assert_eq!(response.body().preset_size(), None);
    assert_eq!(Value::Array(events(&text(response))), expected("items.medium.json")["items"]);
}
