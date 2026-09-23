use poem::http::header::LOCATION;
use poem::http::{StatusCode, Uri};
use poem::web::{Data, Json, Path};
use poem::{EndpointExt, IntoResponse, Response, Route, get, handler, post};
use serde::Deserialize;

use crate::payloads::Item;
use crate::{Payloads, Shared};

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

// rb:handler items.read,items.head,errors.not_found
/// The row with the id in the path. poem answers HEAD with this handler and leaves the body
/// unwritten.
#[handler]
fn read(Path(id): Path<i64>, Data(&p): Data<&Shared>) -> Result<Json<&'static Item>, StatusCode> {
    p.row(id).map(Json).ok_or(StatusCode::NOT_FOUND)
}

// rb:handler items.create
/// 201, where the item would live, and the item under the id after the last row. The Location is
/// built from the request's path.
#[handler]
fn create(uri: &Uri, Json(item): Json<NewItem>, Data(&p): Data<&Shared>) -> Response {
    let created = item.at(p.large.count + 1);
    let location = format!("{}/{}", uri.path(), created.id);
    Json(created).with_status(StatusCode::CREATED).with_header(LOCATION, location).into_response()
}

// rb:handler items.replace
#[handler]
fn replace(Path(id): Path<i64>, Json(item): Json<NewItem>) -> Json<Item> {
    Json(item.at(id))
}

// rb:handler items.update
#[handler]
fn update(Path(id): Path<i64>, Json(change): Json<ItemPatch>, Data(&p): Data<&Shared>) -> Result<Json<Item>, StatusCode> {
    p.row(id).map(|row| Json(change.onto(row))).ok_or(StatusCode::NOT_FOUND)
}

// rb:handler items.delete
#[handler]
fn remove(Path(id): Path<i64>, Data(&p): Data<&Shared>) -> StatusCode {
    if p.row(id).is_some() { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
}

/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. poem's method
/// router answers a method the path has no endpoint for with 405.
pub fn add(route: Route, p: &'static Payloads) -> Route {
    route
        .at("/items", post(create.data(p)))
        .at("/items/:id", get(read)
            .put(replace).patch(update).delete(remove).data(p))
}
