use actix_multipart::form::MultipartForm;
use actix_multipart::form::bytes::Bytes;
use actix_multipart::form::text::Text;
use actix_web::web::{self, ServiceConfig};
use serde::Serialize;

use crate::Payloads;
use crate::answers::{Echoed, Search};

// rb:wiring forms.*
/// The upload's two fields and its file, read by actix-multipart's derived form before the handler
/// runs. The file is read into memory, and a part that is missing is a 400.
#[derive(MultipartForm)]
struct Upload {
    tenant: Text<String>,
    #[multipart(rename = "requestId")]
    request_id: Text<String>,
    file: Bytes,
}
// rb:end

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

/// forms: bodies bound before the handler runs. actix-web's Form binds a urlencoded body into
/// query.many's struct, and actix-multipart's MultipartForm reads an upload.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/forms/urlencoded", web::post().to(move |search: web::Form<Search>| async move { web::Json(Echoed::new(&p.small, search.into_inner())) }))
        .route("/forms/multipart", web::post().to(|MultipartForm(upload): MultipartForm<Upload>| async move {
            let file = UploadedFile { name: upload.file.file_name.unwrap_or_default(), bytes: upload.file.data.len() };
            web::Json(Uploaded { file, echo: UploadEcho { tenant: upload.tenant.into_inner(), request_id: upload.request_id.into_inner() } })
        }));
}
