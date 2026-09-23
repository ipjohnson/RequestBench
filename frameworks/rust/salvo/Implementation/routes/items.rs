use salvo::http::ParseResult;
use salvo::http::header::LOCATION;
use salvo::prelude::*;
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

// rb:handler items.read,items.head,errors.not_found
/// The row with the id in the path. Salvo writes an absent answer as 404, and strips the body of
/// the answer to HEAD.
#[derive(Clone, Copy)]
struct Read(&'static Payloads);

#[handler]
impl Read {
    async fn handle(&self, req: &mut Request) -> ParseResult<Option<Json<&'static Item>>> {
        Ok(self.0.row(req.try_param("id")?).map(Json))
    }
}
// rb:end

// rb:handler items.create
/// 201, where the item would live, and the item under the id after the last row. Location is built
/// from the request's path.
#[derive(Clone, Copy)]
struct Create(&'static Payloads);

#[handler]
impl Create {
    async fn handle(&self, req: &mut Request, res: &mut Response) -> ParseResult<()> {
        let created = req.parse_json::<NewItem>().await?.at(self.0.large.count + 1);
        let location = format!("{}/{}", req.uri().path(), created.id);
        res.status_code(StatusCode::CREATED);
        res.add_header(LOCATION, location, true).expect("a path and a number are a header value");
        res.render(Json(created));
        Ok(())
    }
}
// rb:end

// rb:handler items.replace
/// The whole item put at the id in the path.
#[handler]
async fn replace(req: &mut Request) -> ParseResult<Json<Item>> {
    let id = req.try_param("id")?;
    Ok(Json(req.parse_json::<NewItem>().await?.at(id)))
}

// rb:handler items.update
/// Two fields patched onto the row.
#[derive(Clone, Copy)]
struct Update(&'static Payloads);

#[handler]
impl Update {
    async fn handle(&self, req: &mut Request) -> ParseResult<Option<Json<Item>>> {
        let id = req.try_param("id")?;
        let change = req.parse_json::<ItemPatch>().await?;
        Ok(self.0.row(id).map(|row| Json(change.onto(row))))
    }
}
// rb:end

// rb:handler items.delete
/// 204 and no body for a row that exists, 404 for one that does not.
#[derive(Clone, Copy)]
struct Delete(&'static Payloads);

#[handler]
impl Delete {
    async fn handle(&self, req: &mut Request) -> ParseResult<StatusCode> {
        Ok(if self.0.row(req.try_param("id")?).is_some() { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND })
    }
}
// rb:end

/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. Salvo matches
/// HEAD to a route registered for HEAD and to no other, so the read handler is registered for both,
/// and it answers a method the path has no route for with 405.
pub fn router(p: &'static Payloads) -> Router {
    Router::with_path("/items")
        .post(Create(p))
        .push(Router::with_path("{id}").get(Read(p)).head(Read(p)).put(replace).patch(Update(p)).delete(Delete(p)))
}
