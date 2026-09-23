use poem::http::StatusCode;
use poem::web::{Data, Form, Json, Multipart};
use poem::{EndpointExt, Error, Result, Route, handler, post};
use serde::Serialize;

use crate::answers::{Echoed, Search};
use crate::{Payloads, Shared};

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

// rb:handler forms.urlencoded
/// query.many's eight fields, bound from the form by poem's Form extractor.
#[handler]
fn urlencoded(Form(search): Form<Search>, Data(&p): Data<&Shared>) -> Json<Echoed<'static, Search>> {
    Json(Echoed::new(&p.small, search))
}

// rb:handler forms.multipart
/// The two fields and the file, read part by part. poem's Multipart hands over each part as it
/// arrives, and a part that is missing is a 400.
#[handler]
async fn multipart(mut form: Multipart) -> Result<Json<Uploaded>> {
    let (mut tenant, mut request_id, mut file) = (None, None, None);
    while let Some(part) = form.next_field().await? {
        match part.name() {
            Some("tenant") => tenant = Some(part.text().await?),
            Some("requestId") => request_id = Some(part.text().await?),
            Some("file") => {
                let name = part.file_name().unwrap_or_default().to_owned();
                let bytes = part.bytes().await?.len();
                file = Some(UploadedFile { name, bytes });
            }
            _ => {}
        }
    }
    match (tenant, request_id, file) {
        (Some(tenant), Some(request_id), Some(file)) => Ok(Json(Uploaded { file, echo: UploadEcho { tenant, request_id } })),
        _ => Err(Error::from_status(StatusCode::BAD_REQUEST)),
    }
}

/// forms: bodies bound by poem's own extractors. Form binds a urlencoded body into query.many's
/// struct, and Multipart reads an upload.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/forms/urlencoded", post(urlencoded.data(p)))
        .at("/forms/multipart", post(multipart))
}
