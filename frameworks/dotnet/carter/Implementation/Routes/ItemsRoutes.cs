using Carter;

namespace Implementation.Routes;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not
/// leave the server changed, so the writes store nothing and answer as if they had written.
/// ASP.NET Core answers a method the path has no route for with 405 on its own.
/// </summary>
public sealed class ItemsRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        // A GET route does not answer HEAD in ASP.NET Core, so the route names both, and
        // Kestrel leaves the body unwritten for HEAD.
        // rb:handler items.read,items.head
        // rb:handler errors.not_found
        app.MapMethods("/items/{id:int}", [HttpMethods.Get, HttpMethods.Head], (int id, Payloads p) =>
            p.Row(id) is Item row ? Results.Ok(row) : Results.NotFound());

        app.MapPost("/items", (NewItem item, Payloads p) =>
        {
            Item created = item.At(p.Large.Count + 1);
            return Results.Created($"/items/{created.Id}", created);
        });

        // rb:handler items.replace
        app.MapPut("/items/{id:int}", (int id, NewItem item) => item.At(id));

        // rb:handler items.update
        app.MapPatch("/items/{id:int}", (int id, ItemPatch patch, Payloads p) =>
            p.Row(id) is Item row ? Results.Ok(patch.Onto(row)) : Results.NotFound());

        // rb:handler items.delete
        app.MapDelete("/items/{id:int}", (int id, Payloads p) =>
            p.Row(id) is null ? Results.NotFound() : Results.NoContent());
    }
}
