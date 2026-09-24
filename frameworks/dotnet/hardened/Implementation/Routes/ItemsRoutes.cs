using Hardened.Requests.Abstract.Responses;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Responses;

namespace Implementation.Routes;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. The GET route
/// answers HEAD too, and Hardened drops the body. A method the path has no route for is a 405.
/// </summary>
public class ItemsRoutes(Payloads payloads)
{
    // rb:handler items.head
    // rb:handler errors.not_found
    [Get("/items/{id:int}")]
    public Response<Item, NotFound> Read(int id) =>
        payloads.Row(id) is Item row ? row : new NotFound("item", $"No item has id {id}.");

    [Post("/items")]
    public Created<Item> Create(NewItem item)
    {
        Item created = item.At(payloads.Large.Count + 1);
        return new(created, ImplementationLibrary.Routes.ItemsRoutes.Read(created.Id));
    }

    [Put("/items/{id:int}")]
    public Item Replace(int id, NewItem item) => item.At(id);

    [Patch("/items/{id:int}")]
    public Response<Item, NotFound> Update(int id, ItemPatch patch) =>
        payloads.Row(id) is Item row ? patch.Onto(row) : new NotFound("item", $"No item has id {id}.");

    [Delete("/items/{id:int}")]
    public Response<NoContent, NotFound> Delete(int id) =>
        payloads.Row(id) is null ? new NotFound("item", $"No item has id {id}.") : new NoContent();
}
