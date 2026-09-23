use actix_web::http::StatusCode;
use serde_json::json as literal;

use crate::support::{app, expected, json, with_echo};

const BOUND: [(&str, &str); 3] = [("x-rb-tenant", "qwertyuiopas"), ("x-rb-request-id", "0123456789abcdef"), ("x-rb-account", "482913")];

/// Twenty-five headers the handler never reads, as many as headers.many adds.
fn many() -> Vec<(String, String)> {
    (0..25).map(|n| (format!("x-rb-extra-{n}"), "value".to_owned())).collect()
}

fn with_many(extra: &[(String, String)]) -> Vec<(String, String)> {
    BOUND.iter().map(|(k, v)| ((*k).to_owned(), (*v).to_owned())).chain(extra.iter().cloned()).collect()
}

fn pairs(headers: &[(String, String)]) -> Vec<(&str, &str)> {
    headers.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect()
}

// rb:test headers.few,headers.many
/// headers.few and headers.many: the handler reads no header, however many arrive.
#[actix_web::test]
async fn headers_nobody_reads_change_nothing() {
    let app = app().await;
    for extra in [vec![], many()] {
        let response = app.get_with("/headers", &pairs(&with_many(&extra))).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(json(response).await, expected("items.small.json"));
    }
}

// rb:test headers.bind_few,headers.bind_many
/// headers.bind_few and headers.bind_many: three headers bound by actix-web's Header extractor and
/// echoed, the account as an integer, however many others arrive.
#[actix_web::test]
async fn three_headers_are_bound_and_echoed() {
    let app = app().await;
    for extra in [vec![], many()] {
        let response = app.get_with("/headers/bind", &pairs(&with_many(&extra))).await;

        let echo = literal!({ "tenant": "qwertyuiopas", "requestId": "0123456789abcdef", "account": 482913 });
        assert_eq!(json(response).await, with_echo("items.small.json", echo));
    }
}

#[actix_web::test]
async fn an_account_that_is_not_a_number_is_400() {
    let response = app().await.get_with("/headers/bind", &[("x-rb-tenant", "t"), ("x-rb-request-id", "r"), ("x-rb-account", "many")]).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
