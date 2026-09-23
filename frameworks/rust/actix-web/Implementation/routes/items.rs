use actix_web::http::header::LOCATION;
use actix_web::web::{self, ServiceConfig};
use actix_web::{HttpRequest, HttpResponse};
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

// rb:handler items.read,items.head
/// The row with this id, or 404.
fn read(p: &Payloads, id: i64) -> HttpResponse {
    match p.row(id) {
        Some(row) => HttpResponse::Ok().json(row),
        None => HttpResponse::NotFound().finish(),
    }
}

/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. The resource
/// answers a method it has no route for with 405 and the methods it has. actix-web runs a route for
/// HEAD only where one names it, so HEAD has a route of its own onto the GET handler, and actix-web's
/// HTTP/1 codec leaves the body unwritten.
pub fn configure(cfg: &mut ServiceConfig, p: &'static Payloads) {
    cfg.route("/items", web::post().to(move |request: HttpRequest, item: web::Json<NewItem>| async move {
        let created = item.into_inner().at(p.large.count + 1);
        HttpResponse::Created().insert_header((LOCATION, format!("{}/{}", request.path(), created.id))).json(created)
    }))
    .service(
        web::resource("/items/{id}")
            .route(web::get().to(move |id: web::Path<i64>| async move { read(p, id.into_inner()) }))
            .route(web::head().to(move |id: web::Path<i64>| async move { read(p, id.into_inner()) }))
            // rb:handler items.replace
            .route(web::put().to(|id: web::Path<i64>, item: web::Json<NewItem>| async move { web::Json(item.into_inner().at(id.into_inner())) }))
            // rb:handler items.update
            .route(web::patch().to(move |id: web::Path<i64>, change: web::Json<ItemPatch>| async move {
                match p.row(id.into_inner()) {
                    Some(row) => HttpResponse::Ok().json(change.into_inner().onto(row)),
                    None => HttpResponse::NotFound().finish(),
                }
            }))
            // rb:handler items.delete
            .route(web::delete().to(move |id: web::Path<i64>| async move {
                match p.row(id.into_inner()) {
                    Some(_) => HttpResponse::NoContent().finish(),
                    None => HttpResponse::NotFound().finish(),
                }
            })),
    );
}
