using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not
/// leave the server changed, so the writes store nothing and answer as if they had written.
/// Wolverine answers 404 when an endpoint returns null, and ASP.NET Core answers a method the
/// path has no route for with 405. On every method but GET, Wolverine reads the body into the
/// first parameter of a type it has no other source for, so the payloads are [FromServices] there.
/// </summary>
public static class ItemsEndpoints
{
    // rb:handler items.read
    // rb:handler errors.not_found
    [WolverineGet("/items/{id}")]
    public static Item? Read(int id, Payloads p) => p.Row(id);

    // A GET route does not answer HEAD, so HEAD has a route of its own, and Kestrel leaves the
    // body unwritten.
    // rb:handler items.head
    [WolverineHead("/items/{id}")]
    public static Item? Head(int id, [FromServices] Payloads p) => p.Row(id);

    [WolverinePost("/items")]
    public static Created<Item> Create(NewItem item, [FromServices] Payloads p)
    {
        Item created = item.At(p.Large.Count + 1);
        return TypedResults.Created($"/items/{created.Id}", created);
    }

    // rb:handler items.replace
    [WolverinePut("/items/{id}")]
    public static Item Replace(int id, NewItem item) => item.At(id);

    // rb:handler items.update
    [WolverinePatch("/items/{id}")]
    public static Item? Update(int id, ItemPatch patch, [FromServices] Payloads p) => p.Row(id) is Item row ? patch.Onto(row) : null;

    // Wolverine writes a returned int as the status, with no body.
    // rb:handler items.delete
    [WolverineDelete("/items/{id}")]
    public static int Delete(int id, [FromServices] Payloads p) => p.Row(id) is null ? StatusCodes.Status404NotFound : StatusCodes.Status204NoContent;
}
