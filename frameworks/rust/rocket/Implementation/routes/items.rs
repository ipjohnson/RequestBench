use rocket::response::status::{Created, NoContent};
use rocket::serde::json::Json;
use rocket::{Build, Rocket, State, delete, get, patch, post, put, routes, uri};
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
/// the server changed, so the writes store nothing and answer as if they had written. A handler
/// that answers None is a 404 from Rocket's catcher. Rocket answers HEAD with the GET route and
/// strips the body, and routes a method the path has no route for nowhere, which is its 404.
// rb:handler items.read,items.head
#[get("/items/<id>")]
fn read(id: i64, p: &State<Payloads>) -> Option<Json<&Item>> {
    p.row(id).map(Json)
}

/// The created item's Location is the read route's own URI for it, as Rocket's uri! builds it.
#[post("/items", data = "<item>")]
fn create(item: Json<NewItem>, p: &State<Payloads>) -> Created<Json<Item>> {
    let created = item.into_inner().at(p.large.count + 1);
    Created::new(uri!(read(created.id)).to_string()).body(Json(created))
}

#[put("/items/<id>", data = "<item>")]
fn replace(id: i64, item: Json<NewItem>) -> Json<Item> {
    Json(item.into_inner().at(id))
}

#[patch("/items/<id>", data = "<change>")]
fn update(id: i64, change: Json<ItemPatch>, p: &State<Payloads>) -> Option<Json<Item>> {
    p.row(id).map(|row| Json(change.into_inner().onto(row)))
}

#[delete("/items/<id>")]
fn remove(id: i64, p: &State<Payloads>) -> Option<NoContent> {
    p.row(id).map(|_| NoContent)
}

pub fn stage(rocket: Rocket<Build>, _: &Payloads) -> Rocket<Build> {
    rocket.mount("/", routes![read, create, replace, update, remove])
}
