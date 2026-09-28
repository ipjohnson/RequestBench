use async_trait::async_trait;
use loco_rs::app::{AppContext, Hooks, Initializer};
use loco_rs::bgworker::Queue;
use loco_rs::boot::{BootResult, StartMode, create_app};
use loco_rs::config::Config;
use loco_rs::controller::AppRoutes;
use loco_rs::environment::Environment;
use loco_rs::task::Tasks;
use loco_rs::{Error, Result};
use serde::Deserialize;

use crate::payloads::Payloads;
use crate::{controllers, initializers};

/// The application, as Loco's starter writes one: its Hooks boot it, add its initializer and its
/// routes, and complete the context Loco creates from the environment's config file.
pub struct App;

/// The settings block of the environment's config file.
#[derive(Deserialize)]
struct Settings {
    /// The payload directory, which the config file reads from RB_PAYLOADS.
    payloads: String,
}

#[async_trait]
impl Hooks for App {
    fn app_name() -> &'static str {
        env!("CARGO_CRATE_NAME")
    }

    async fn boot(mode: StartMode, environment: &Environment, config: Config) -> Result<BootResult> {
        create_app::<Self>(mode, environment, config).await
    }

    /// The payloads, loaded before the server starts, so a missing or broken file stops the boot
    /// rather than failing a request. They go in Loco's shared store, which a handler extracts
    /// them from.
    async fn after_context(ctx: AppContext) -> Result<AppContext> {
        let settings: Settings = ctx.config.settings()?;
        let payloads = Payloads::load(&settings.payloads).map_err(Error::Message)?;
        ctx.shared_store.insert(payloads);
        Ok(ctx)
    }

    async fn initializers(_ctx: &AppContext) -> Result<Vec<Box<dyn Initializer>>> {
        Ok(vec![Box::new(initializers::view_engine::ViewEngineInitializer)])
    }

    fn routes(_ctx: &AppContext) -> AppRoutes {
        AppRoutes::with_default_routes()
            .add_route(controllers::contract::routes())
            .add_route(controllers::baseline::routes())
            .add_route(controllers::json::routes())
            .add_routes(controllers::middleware::routes())
            .add_route(controllers::parameters::routes())
            .add_route(controllers::query::routes())
            .add_route(controllers::headers::routes())
            .add_route(controllers::body::routes())
            .add_route(controllers::authorized::routes())
            .add_route(controllers::items::routes())
            .add_route(controllers::cache::routes())
            .add_route(controllers::etag::routes())
            .add_route(controllers::compressed::routes())
            .add_route(controllers::cors::routes())
            .add_route(controllers::forms::routes())
            .add_route(controllers::stream::routes())
            .add_route(controllers::sse::routes())
            .add_route(controllers::template::routes())
    }

    async fn connect_workers(_ctx: &AppContext, _queue: &Queue) -> Result<()> {
        Ok(())
    }

    fn register_tasks(_tasks: &mut Tasks) {}
}
