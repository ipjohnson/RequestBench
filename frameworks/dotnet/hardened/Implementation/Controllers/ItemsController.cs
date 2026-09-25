using Hardened.Requests.Abstract.Responses;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Responses;

namespace Implementation.Controllers;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not leave
/// the server changed, so the writes store nothing and answer as if they had written. Hardened
/// answers a method the path has no route for with 405.
/// </summary>
public static class ItemsController
{
    /// <remarks>
    /// A GET route answers HEAD too. Hardened runs the handler and sends the headers with no body.
    /// </remarks>
    // rb:handler items.read,items.head,errors.not_found
    [Get("/items/{id:int}")]
    public static Response<Item, NotFound> Read(IPayloads p, int id) =>
        p.Row(id) is Item row ? row : new NotFound("item", $"No item has id {id}.");

    [Post("/items")]
    public static Created<Item> Create(IPayloads p, NewItem item)
    {
        Item created = item.At(p.Large.Count + 1);
        return new Created<Item>(created, ImplementationLibrary.Routes.Items.Read(created.Id));
    }

    [Put("/items/{id:int}")]
    public static Item Replace(int id, NewItem item) => item.At(id);

    [Patch("/items/{id:int}")]
    public static Response<Item, NotFound> Update(IPayloads p, int id, ItemPatch patch) =>
        p.Row(id) is Item row ? patch.Onto(row) : new NotFound("item", $"No item has id {id}.");

    [Delete("/items/{id:int}")]
    public static Response<NoContent, NotFound> Delete(IPayloads p, int id) =>
        p.Row(id) is null ? new NotFound("item", $"No item has id {id}.") : new NoContent();
}
