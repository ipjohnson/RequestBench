use rocket::http::Status;

use crate::support::{client, expected, get, json};

// rb:test middleware.none,middleware.four,middleware.sixteen
/// middleware.none, middleware.four and middleware.sixteen: the guards pass the request through to
/// the handler.
#[test]
fn the_guards_reach_the_handler() {
    let client = client();
    for path in ["/middleware/none", "/middleware/four", "/middleware/sixteen"] {
        let response = get(&client, path, &[]);

        assert_eq!(response.status(), Status::Ok, "{path}");
        assert_eq!(json(response), expected("items.small.json"));
    }
}
