use bytes::BufMut;
use futures_util::StreamExt;
use serde::Serialize;
use warp::http::StatusCode;
use warp::multipart::{FormData, Part};
use warp::Filter;

use crate::answers::{Echoed, Search};
use crate::{Payloads, Routes, answer};

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

/// forms: bodies bound by warp's own filters. body::form binds a urlencoded body into query.many's
/// struct, and multipart::form hands over an upload part by part.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler forms.urlencoded
    let urlencoded = warp::path!("forms" / "urlencoded").and(warp::post()).and(warp::body::form()).map(move |search: Search| warp::reply::json(&Echoed::new(&p.small, search)));
    // rb:handler forms.multipart
    let multipart = warp::path!("forms" / "multipart").and(warp::post()).and(warp::multipart::form()).then(upload);
    answer(urlencoded).or(answer(multipart)).unify().boxed()
}

/// The two fields and the file, read part by part as they arrive. A part that is missing, or a
/// body the parser cannot read, is a 400.
async fn upload(mut form: FormData) -> Result<warp::reply::Json, StatusCode> {
    let (mut tenant, mut request_id, mut file) = (None, None, None);
    while let Some(part) = form.next().await {
        let part = part.map_err(|_| StatusCode::BAD_REQUEST)?;
        match part.name() {
            "tenant" => tenant = Some(text(part).await?),
            "requestId" => request_id = Some(text(part).await?),
            "file" => {
                let name = part.filename().unwrap_or_default().to_owned();
                let bytes = content(part).await?.len();
                file = Some(UploadedFile { name, bytes });
            }
            _ => {}
        }
    }
    match (tenant, request_id, file) {
        (Some(tenant), Some(request_id), Some(file)) => Ok(warp::reply::json(&Uploaded { file, echo: UploadEcho { tenant, request_id } })),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

/// A part's bytes, read to its end.
async fn content(mut part: Part) -> Result<Vec<u8>, StatusCode> {
    let mut bytes = Vec::new();
    while let Some(chunk) = part.data().await {
        let chunk = chunk.map_err(|_| StatusCode::BAD_REQUEST)?;
        bytes.put(chunk);
    }
    Ok(bytes)
}

async fn text(part: Part) -> Result<String, StatusCode> {
    String::from_utf8(content(part).await?).map_err(|_| StatusCode::BAD_REQUEST)
}
