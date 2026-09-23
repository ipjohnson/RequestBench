use rocket::form::Form;
use rocket::fs::TempFile;
use rocket::serde::json::Json;
use rocket::{Build, FromForm, Rocket, State, post, routes};
use serde::Serialize;

use crate::Payloads;
use crate::answers::{Echoed, Search};

/// The two fields and the file of an upload. Rocket's Form reads the parts into it, and TempFile
/// writes the file's part to a temporary file before the handler runs.
#[derive(FromForm)]
struct Upload<'r> {
    tenant: &'r str,
    #[field(name = "requestId")]
    request_id: &'r str,
    file: TempFile<'r>,
}

#[derive(Serialize)]
struct UploadedFile {
    name: String,
    bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadEcho<'r> {
    tenant: &'r str,
    request_id: &'r str,
}

#[derive(Serialize)]
struct Uploaded<'r> {
    file: UploadedFile,
    echo: UploadEcho<'r>,
}

/// forms: bodies bound by Rocket's own Form data guard. A urlencoded body binds into query.many's
/// struct, and a multipart upload into Upload.
#[post("/forms/urlencoded", data = "<search>")]
fn urlencoded<'r>(search: Form<Search<'r>>, p: &'r State<Payloads>) -> Json<Echoed<'r, Search<'r>>> {
    Json(Echoed::new(&p.small, search.into_inner()))
}

/// TempFile::name() is the sanitised name, which drops everything from the first dot, so the
/// name the client sent is read raw. It is echoed and never used as a path.
#[post("/forms/multipart", data = "<upload>")]
fn multipart<'r>(upload: Form<Upload<'r>>) -> Json<Uploaded<'r>> {
    let upload = upload.into_inner();
    let name = upload.file.raw_name().map_or_else(String::new, |name| name.dangerous_unsafe_unsanitized_raw().to_string());
    Json(Uploaded {
        file: UploadedFile { name, bytes: upload.file.len() },
        echo: UploadEcho { tenant: upload.tenant, request_id: upload.request_id },
    })
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![urlencoded, multipart])
}
