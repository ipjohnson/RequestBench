use warp::http::StatusCode;

use crate::support::{app, expected, get, json};

// rb:test middleware.none,middleware.four,middleware.sixteen
/// middleware.none, middleware.four and middleware.sixteen: the middleware passes the request
/// through to the handler.
#[tokio::test]
async fn the_middleware_reaches_the_handler() {
    for path in ["/middleware/none", "/middleware/four", "/middleware/sixteen"] {
        let response = get(&app(), path).await;

        assert_eq!(response.status(), StatusCode::OK, "{path}");
        assert_eq!(json(&response), expected("items.small.json"));
    }
}
