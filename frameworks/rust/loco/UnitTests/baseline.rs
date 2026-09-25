use implementation::app::App;
use loco_rs::testing::request::request;

// rb:test baseline.plaintext
/// baseline.plaintext: the string, as text/plain.
#[tokio::test]
async fn plaintext_is_the_string_as_text() {
    request::<App, _, _>(|server, _| async move {
        let response = server.get("/plaintext").await;

        response.assert_status_ok();
        assert_eq!(response.header("content-type"), "text/plain; charset=utf-8");
        assert_eq!(response.text(), "Hello, World!");
    })
    .await;
}
