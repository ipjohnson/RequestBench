use salvo::http::{ParseError, ParseResult};
use salvo::prelude::*;
use serde::Serialize;

use crate::Payloads;
use crate::answers::{Echoed, Search};
use crate::payloads::Payload;

#[derive(Serialize)]
struct UploadedFile {
    name: String,
    bytes: u64,
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

// rb:handler forms.urlencoded
/// query.many's eight values posted as a form, bound by Salvo's parse_form.
#[derive(Clone, Copy)]
struct Urlencoded(&'static Payload);

#[handler]
impl Urlencoded {
    async fn handle(&self, req: &mut Request) -> ParseResult<Json<Echoed<'static, Search>>> {
        Ok(Json(Echoed::new(self.0, req.parse_form::<Search>().await?)))
    }
}
// rb:end

// rb:handler forms.multipart
/// The two fields and the file, read by Salvo's form_data, which writes each file part to a
/// temporary directory of its own and removes it once the part is dropped. A part that is missing
/// is Salvo's ParseError::NotExist, which it answers with 400.
#[handler]
async fn upload(req: &mut Request) -> ParseResult<Json<Uploaded>> {
    let form = req.form_data().await?;
    let field = |name: &str| form.fields.get(name).cloned().ok_or(ParseError::NotExist);
    let echo = UploadEcho { tenant: field("tenant")?, request_id: field("requestId")? };
    let part = form.files.get("file").ok_or(ParseError::NotExist)?;
    let file = UploadedFile { name: part.name().unwrap_or_default().to_owned(), bytes: part.size() };
    Ok(Json(Uploaded { file, echo }))
}

/// forms: bodies bound by Salvo's own readers. parse_form binds a urlencoded body into query.many's
/// struct, and form_data reads an upload.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/forms")
        .push(Router::with_path("urlencoded").post(Urlencoded(&p.small)))
        .push(Router::with_path("multipart").post(upload))
}
