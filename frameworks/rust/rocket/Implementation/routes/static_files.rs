use std::path::PathBuf;
use std::time::SystemTime;

use rocket::fs::FileServer;
use rocket::http::Header;
use rocket::http::uri::Segments;
use rocket::http::uri::fmt::Path;
use rocket::outcome::Outcome;
use rocket::route::{self, Handler, Route};
use rocket::{Build, Data, Request, Rocket};

use crate::Payloads;

/// static: Rocket's FileServer over the payload directory, mounted at /static. It writes the
/// file's type and length. It writes no modification time, so its answer gets one from the file.
pub fn stage(rocket: Rocket<Build>, p: &Payloads) -> Rocket<Build> {
    // rb:handler static.file
    // rb:wiring static.*
    rocket.mount("/static", stamped(FileServer::from(&p.dir), &p.dir))
}

// rb:wiring static.*
/// FileServer's route, its handler wrapped in one that adds Last-Modified to what it answers.
fn stamped(files: FileServer, dir: &std::path::Path) -> Vec<Route> {
    let routes: Vec<Route> = files.into();
    let wrap = |mut route: Route| {
        route.handler = Box::new(Stamped { files: route.handler.clone(), dir: dir.to_owned() });
        route
    };
    routes.into_iter().map(wrap).collect()
}

#[derive(Clone)]
struct Stamped {
    files: Box<dyn Handler>,
    dir: PathBuf,
}

#[rocket::async_trait]
impl Handler for Stamped {
    async fn handle<'r>(&self, request: &'r Request<'_>, data: Data<'r>) -> route::Outcome<'r> {
        let mut outcome = self.files.handle(request, data).await;
        if let Outcome::Success(response) = &mut outcome {
            if let Some(modified) = self.modified(request) {
                response.set_header(Header::new("Last-Modified", httpdate::fmt_http_date(modified)));
            }
        }
        outcome
    }
}

impl Stamped {
    /// The file the request names, found as FileServer finds it.
    fn modified(&self, request: &Request<'_>) -> Option<SystemTime> {
        let path = request.segments::<Segments<'_, Path>>(0..).ok()?.to_path_buf(false).ok()?;
        std::fs::metadata(self.dir.join(path)).ok()?.modified().ok()
    }
}
// rb:end
