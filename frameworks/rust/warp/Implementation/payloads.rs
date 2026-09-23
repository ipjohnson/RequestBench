use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

// rb:wiring json.*
/// One row of items.large, and of every payload made from it.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub price_cents: i64,
    pub in_stock: bool,
}

/// items.small, items.medium or items.large.
#[derive(Debug, Deserialize, Serialize)]
pub struct Payload {
    pub size: String,
    pub count: i64,
    pub items: Vec<Item>,
}
// rb:end

/// The values the framework configures itself from, as settings.json holds them.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub token: String,
    pub cache: CacheSettings,
    pub cors: CorsSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheSettings {
    pub capacity: usize,
    pub ttl_seconds: u64,
    pub vary: VarySettings,
}

/// The values each vary row is keyed on, by header.
#[derive(Debug, Deserialize)]
pub struct VarySettings {
    pub one: BTreeMap<String, Vec<String>>,
    pub many: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorsSettings {
    pub origin: String,
    pub method: String,
    pub header: String,
    pub max_age_seconds: u64,
}

/// The committed payloads, read from the directory RB_PAYLOADS names before the server starts,
/// so a missing or broken file stops the boot rather than failing a request. The parsed values
/// are kept for the life of the process and serialised on every request.
#[derive(Debug)]
pub struct Payloads {
    pub dir: PathBuf,
    pub small: Payload,
    pub medium: Payload,
    pub large: Payload,
    pub settings: Settings,
    rows: HashMap<i64, usize>,
}

impl Payloads {
    pub fn load(dir: impl AsRef<Path>) -> Result<&'static Payloads, String> {
        let dir = fs::canonicalize(dir.as_ref()).map_err(|e| format!("{}: {e}", dir.as_ref().display()))?;
        let large: Payload = read(&dir, "items.large.json")?;
        let rows = large.items.iter().enumerate().map(|(at, row)| (row.id, at)).collect();
        let payloads = Payloads {
            small: read(&dir, "items.small.json")?,
            medium: read(&dir, "items.medium.json")?,
            large,
            settings: read(&dir, "settings.json")?,
            rows,
            dir,
        };
        Ok(Box::leak(Box::new(payloads)))
    }

    /// The row of items.large with this id.
    pub fn row(&self, id: i64) -> Option<&Item> {
        self.rows.get(&id).map(|&at| &self.large.items[at])
    }
}

fn read<T: DeserializeOwned>(dir: &Path, file: &str) -> Result<T, String> {
    let bytes = fs::read(dir.join(file)).map_err(|e| format!("{file}: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("{file}: {e}"))
}
