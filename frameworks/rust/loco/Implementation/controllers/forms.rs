use axum::extract::multipart::MultipartError;
use loco_rs::prelude::*;
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

// forms: bodies bound by the extractors Loco's prelude hands a controller, which are axum's. Form
// binds a urlencoded body into query.many's struct, and Multipart reads an upload.

// rb:handler forms.urlencoded
async fn urlencoded(SharedStore(p): SharedStore<&'static Payloads>, Form(search): Form<Search>) -> Result<Response> {
    format::json(Echoed::new(&p.small, search))
}

fn unreadable(error: MultipartError) -> Error {
    Error::BadRequest(error.body_text())
}

// rb:handler forms.multipart
/// The two fields and the file, read part by part. Multipart hands over each part as it arrives,
/// and a part that is missing is Loco's bad_request.
async fn multipart(mut form: Multipart) -> Result<Response> {
    let (mut tenant, mut request_id, mut file) = (None, None, None);
    while let Some(part) = form.next_field().await.map_err(unreadable)? {
        match part.name() {
            Some("tenant") => tenant = Some(part.text().await.map_err(unreadable)?),
            Some("requestId") => request_id = Some(part.text().await.map_err(unreadable)?),
            Some("file") => {
                let name = part.file_name().unwrap_or_default().to_owned();
                let bytes = part.bytes().await.map_err(unreadable)?.len();
                file = Some(UploadedFile { name, bytes });
            }
            _ => {}
        }
    }
    let (Some(tenant), Some(request_id), Some(file)) = (tenant, request_id, file) else {
        return bad_request("the form needs tenant, requestId and file");
    };
    format::json(Uploaded { file, echo: UploadEcho { tenant, request_id } })
}

pub fn routes() -> Routes {
    Routes::new().prefix("forms").add("/urlencoded", post(urlencoded)).add("/multipart", post(multipart))
}
