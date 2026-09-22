use axum::extract::Path;
use axum::http::header::LOCATION;
use axum::http::{StatusCode, Uri};
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
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

/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. axum answers
/// HEAD with the GET route and leaves the body unwritten, and answers a method the path has no
/// route for with 405.
pub fn router(p: &'static Payloads) -> Router {
    Router::new()
        // rb:handler items.read,items.head
        .route("/items/{id}", get(move |Path(id): Path<i64>| async move { p.row(id).map(Json).ok_or(StatusCode::NOT_FOUND) }))
        .route("/items", post(move |uri: Uri, Json(item): Json<NewItem>| async move {
            let created = item.at(p.large.count + 1);
            (StatusCode::CREATED, [(LOCATION, format!("{}/{}", uri.path(), created.id))], Json(created))
        }))
        .route("/items/{id}", put(|Path(id): Path<i64>, Json(item): Json<NewItem>| async move { Json(item.at(id)) }))
        .route("/items/{id}", patch(move |Path(id): Path<i64>, Json(change): Json<ItemPatch>| async move {
            p.row(id).map(|row| Json(change.onto(row))).ok_or(StatusCode::NOT_FOUND)
        }))
        .route("/items/{id}", delete(move |Path(id): Path<i64>| async move {
            if p.row(id).is_some() { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
        }))
}
