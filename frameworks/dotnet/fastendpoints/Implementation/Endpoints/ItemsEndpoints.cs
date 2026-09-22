using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// items: every method on one resource over the rows of items.large. A measured row may not
/// leave the server changed, so the writes store nothing and answer as if they had written.
/// ASP.NET Core's routing answers a method the path has no endpoint for with 405 on its own.
/// </summary>
// rb:handler items.read,items.head
// rb:handler errors.not_found
public sealed class ItemReadEndpoint(Payloads payloads) : Endpoint<ItemId, Item>
{
    // A GET route does not answer HEAD in ASP.NET Core, so the endpoint names both, and
    // Kestrel leaves the body unwritten for HEAD.
    public override void Configure()
    {
        Verbs(Http.GET, Http.HEAD);
        Routes("/items/{id:int}");
    }

    public override Task HandleAsync(ItemId req, CancellationToken ct) =>
        payloads.Row(req.Id) is Item row ? Send.OkAsync(row, ct) : Send.NotFoundAsync(ct);
}

// rb:handler items.create
public sealed class ItemCreateEndpoint(Payloads payloads) : Endpoint<NewItem, Item>
{
    public override void Configure() => Post("/items");

    public override Task HandleAsync(NewItem req, CancellationToken ct)
    {
        Item created = req.At(payloads.Large.Count + 1);
        return Send.CreatedAtAsync<ItemReadEndpoint>(new { id = created.Id }, created, Http.GET, cancellation: ct);
    }
}

// rb:handler items.replace
public sealed class ItemReplaceEndpoint : Endpoint<ReplacedItem, Item>
{
    public override void Configure() => Put("/items/{id:int}");

    public override Task HandleAsync(ReplacedItem req, CancellationToken ct) => Send.OkAsync(req.At(req.Id), ct);
}

// rb:handler items.update
public sealed class ItemUpdateEndpoint(Payloads payloads) : Endpoint<ItemPatch, Item>
{
    public override void Configure() => Patch("/items/{id:int}");

    public override Task HandleAsync(ItemPatch req, CancellationToken ct) =>
        payloads.Row(req.Id) is Item row ? Send.OkAsync(req.Onto(row), ct) : Send.NotFoundAsync(ct);
}

// rb:handler items.delete
public sealed class ItemDeleteEndpoint(Payloads payloads) : Endpoint<ItemId>
{
    public override void Configure() => Delete("/items/{id:int}");

    public override Task HandleAsync(ItemId req, CancellationToken ct) =>
        payloads.Row(req.Id) is null ? Send.NotFoundAsync(ct) : Send.NoContentAsync(ct);
}
