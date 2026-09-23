use serde::Deserialize;
use warp::Filter;
use warp::filters::path::FullPath;
use warp::http::StatusCode;
use warp::http::header::LOCATION;

use crate::payloads::Item;
use crate::{Payloads, Routes, answer};

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
/// the server changed, so the writes store nothing and answer as if they had written. warp's get
/// filter matches GET alone, so the read route takes HEAD as well, as warp's own fs::dir does, and
/// hyper leaves the body of a HEAD answer unwritten. A method the path has no route for is warp's
/// 405.
pub fn routes(p: &'static Payloads) -> Routes {
    // rb:handler items.read,items.head,errors.not_found
    let read = warp::path!("items" / i64).and(warp::get().or(warp::head()).unify()).map(move |id| p.row(id).map(warp::reply::json).ok_or(StatusCode::NOT_FOUND));
    // rb:handler items.create
    let create = warp::path!("items").and(warp::post()).and(warp::path::full()).and(warp::body::json()).map(move |path: FullPath, item: NewItem| {
        let created = item.at(p.large.count + 1);
        let location = format!("{}/{}", path.as_str(), created.id);
        warp::reply::with_status(warp::reply::with_header(warp::reply::json(&created), LOCATION, location), StatusCode::CREATED)
    });
    // rb:handler items.replace
    let replace = warp::path!("items" / i64).and(warp::put()).and(warp::body::json()).map(|id, item: NewItem| warp::reply::json(&item.at(id)));
    // rb:handler items.update
    let update = warp::path!("items" / i64).and(warp::patch()).and(warp::body::json()).map(move |id, change: ItemPatch| p.row(id).map(|row| warp::reply::json(&change.onto(row))).ok_or(StatusCode::NOT_FOUND));
    // rb:handler items.delete
    let delete = warp::path!("items" / i64).and(warp::delete()).map(move |id| if p.row(id).is_some() { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND });
    answer(read).or(answer(create)).unify().or(answer(replace)).unify().or(answer(update)).unify().or(answer(delete)).unify().boxed()
}
