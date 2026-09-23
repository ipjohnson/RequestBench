use actix_web::http::StatusCode;

use crate::support::{app, expected, json};

// rb:test middleware.none,middleware.four,middleware.sixteen
/// middleware.none, middleware.four and middleware.sixteen: the middleware passes the request
/// through to the handler.
#[actix_web::test]
async fn the_middleware_reaches_the_handler() {
    let app = app().await;
    for path in ["/middleware/none", "/middleware/four", "/middleware/sixteen"] {
        let response = app.get(path).await;

        assert_eq!(response.status(), StatusCode::OK, "{path}");
        assert_eq!(json(response).await, expected("items.small.json"));
    }
}
