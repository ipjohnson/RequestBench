use async_trait::async_trait;
use axum::{Extension, Router as AxumRouter};
use loco_rs::app::{AppContext, Initializer};
use loco_rs::controller::views::{ViewEngine, engines};
use loco_rs::Result;

// rb:wiring template.*
/// Loco's Tera view engine over assets/views, as the initializer Loco's starter generates adds it:
/// once the routes are built, as an extension every handler can extract. A release build compiles
/// the templates once, when the application starts.
pub struct ViewEngineInitializer;

#[async_trait]
impl Initializer for ViewEngineInitializer {
    fn name(&self) -> String {
        "view-engine".to_string()
    }

    async fn after_routes(&self, router: AxumRouter, _ctx: &AppContext) -> Result<AxumRouter> {
        let tera_engine = engines::TeraView::build()?;
        Ok(router.layer(Extension(ViewEngine::from(tera_engine))))
    }
}
// rb:end
