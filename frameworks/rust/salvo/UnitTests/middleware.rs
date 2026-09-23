use salvo::http::StatusCode;

use crate::support::{expected, get, json, service, status};

// rb:test middleware.none,middleware.four,middleware.sixteen
/// middleware.none, middleware.four and middleware.sixteen: the hoops pass the request on to the
/// handler.
#[tokio::test]
async fn the_hoops_reach_the_handler() {
    for path in ["/middleware/none", "/middleware/four", "/middleware/sixteen"] {
        let response = get(&service(), path).await;

        assert_eq!(status(&response), StatusCode::OK, "{path}");
        assert_eq!(json(response).await, expected("items.small.json"));
    }
}
