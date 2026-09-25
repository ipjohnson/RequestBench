use axum_test::multipart::{MultipartForm, Part};
use implementation::app::App;
use loco_rs::testing::request::request;
use serde_json::{Value, json};

use crate::support::{file, with_echo};

// rb:test forms.urlencoded
/// forms.urlencoded: query.many's eight values from a form, the numbers as integers.
#[tokio::test]
async fn a_form_is_bound() {
    request::<App, _, _>(|server, _| async move {
        let form = [("page", "417"), ("size", "38"), ("status", "paid"), ("category", "garden"), ("sort", "created"), ("q", "alpha bravo"), ("minPrice", "1200"), ("maxPrice", "34000")];

        let response = server.post("/forms/urlencoded").form(&form).await;

        let echo = json!({ "page": 417, "size": 38, "status": "paid", "category": "garden", "sort": "created", "q": "alpha bravo", "minPrice": 1200, "maxPrice": 34000 });
        assert_eq!(response.json::<Value>(), with_echo("items.small.json", echo));
    })
    .await;
}

// rb:test forms.multipart
/// forms.multipart: the file read to its end, and the two fields echoed.
#[tokio::test]
async fn an_upload_is_read() {
    request::<App, _, _>(|server, _| async move {
        let upload = file("forms.file.txt");
        let form = MultipartForm::new()
            .add_text("tenant", "qwertyuiopas")
            .add_text("requestId", "0123456789abcdef")
            .add_part("file", Part::bytes(upload.clone()).file_name("forms.file.txt").mime_type("text/plain"));

        let response = server.post("/forms/multipart").multipart(form).await;

        response.assert_status_ok();
        let echo = json!({ "file": { "name": "forms.file.txt", "bytes": upload.len() }, "echo": { "tenant": "qwertyuiopas", "requestId": "0123456789abcdef" } });
        assert_eq!(response.json::<Value>(), echo);
    })
    .await;
}
