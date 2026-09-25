use axum::http::StatusCode;
use axum::http::header::LOCATION;
use loco_rs::prelude::*;
use serde::Deserialize;

use crate::Payloads;
use crate::payloads::Item;

/// An item as a client creates or replaces one.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewItem {
    name: String,
    category: String,
    price_cents: i64,
    in_stock: bool,
}

impl NewItem {
    fn at(self, id: i64) -> Item {
        Item { id, name: self.name, category: self.category, price_cents: self.price_cents, in_stock: self.in_stock }
    }
}

/// The two fields items.update changes.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemPatch {
    price_cents: Option<i64>,
    in_stock: Option<bool>,
}

impl ItemPatch {
    fn onto(self, row: &Item) -> Item {
        Item { price_cents: self.price_cents.unwrap_or(row.price_cents), in_stock: self.in_stock.unwrap_or(row.in_stock), ..row.clone() }
    }
}

// items: every method on one resource over the rows of items.large. A measured row may not leave
// the server changed, so the writes store nothing and answer as if they had written. A missing row
// is Loco's not_found. axum answers HEAD with the GET route.

// rb:handler items.create
async fn create(SharedStore(p): SharedStore<&'static Payloads>, Json(item): Json<NewItem>) -> Result<Response> {
    let created = item.at(p.large.count + 1);
    format::render().status(StatusCode::CREATED).header(LOCATION, format!("/items/{}", created.id)).json(created)
}

// rb:handler items.read,items.head
// rb:handler errors.not_found
async fn read(Path(id): Path<i64>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    let Some(row) = p.row(id) else { return not_found() };
    format::json(row)
}

// rb:handler items.replace
async fn replace(Path(id): Path<i64>, Json(item): Json<NewItem>) -> Result<Response> {
    format::json(item.at(id))
}

// rb:handler items.update
async fn update(Path(id): Path<i64>, SharedStore(p): SharedStore<&'static Payloads>, Json(change): Json<ItemPatch>) -> Result<Response> {
    let Some(row) = p.row(id) else { return not_found() };
    format::json(change.onto(row))
}

// rb:handler items.delete
async fn remove(Path(id): Path<i64>, SharedStore(p): SharedStore<&'static Payloads>) -> Result<Response> {
    if p.row(id).is_none() {
        return not_found();
    }
    format::render().status(StatusCode::NO_CONTENT).empty()
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("items")
        .add("/", post(create))
        .add("/{id}", get(read).put(replace).patch(update).delete(remove))
}
