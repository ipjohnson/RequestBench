use axum::extract::Multipart;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Form, Json, Router};
use serde::Serialize;

use crate::Payloads;
use crate::answers::{Echoed, Search};

#[derive(Serialize)]
struct UploadedFile {
    name: String,
    bytes: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadEcho {
    tenant: String,
    request_id: String,
}

#[derive(Serialize)]
struct Uploaded {
    file: UploadedFile,
    echo: UploadEcho,
}

// rb:handler forms.multipart
/// The two fields and the file, read part by part. axum's Multipart hands over each part as it
/// arrives, and a part that is missing is a 400.
async fn upload(mut form: Multipart) -> Result<Json<Uploaded>, Response> {
    let (mut tenant, mut request_id, mut file) = (None, None, None);
    while let Some(part) = form.next_field().await.map_err(IntoResponse::into_response)? {
        match part.name() {
            Some("tenant") => tenant = Some(part.text().await.map_err(IntoResponse::into_response)?),
            Some("requestId") => request_id = Some(part.text().await.map_err(IntoResponse::into_response)?),
            Some("file") => {
                let name = part.file_name().unwrap_or_default().to_owned();
                let bytes = part.bytes().await.map_err(IntoResponse::into_response)?.len();
                file = Some(UploadedFile { name, bytes });
            }
            _ => {}
        }
    }
    match (tenant, request_id, file) {
        (Some(tenant), Some(request_id), Some(file)) => Ok(Json(Uploaded { file, echo: UploadEcho { tenant, request_id } })),
        _ => Err(StatusCode::BAD_REQUEST.into_response()),
    }
}

/// forms: bodies bound by axum's own extractors. Form binds a urlencoded body into query.many's
/// struct, and Multipart reads an upload.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        .route("/forms/urlencoded", post(move |Form(search): Form<Search>| async move { Json(Echoed::new(&p.small, search)) }))
        .route("/forms/multipart", post(upload))
}
