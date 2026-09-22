using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// query: query string values bound onto the request type's properties by name, where the
/// property's type is the conversion.
/// </summary>
// rb:handler query.one
public sealed class QueryOneEndpoint(Payloads payloads) : Endpoint<QueryOne, Echoed<QueryOne>>
{
    public override void Configure() => Get("/query/one");

    public override Task HandleAsync(QueryOne req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}

// rb:handler query.many
public sealed class QueryManyEndpoint(Payloads payloads) : Endpoint<Search, Echoed<Search>>
{
    public override void Configure() => Get("/query/many");

    public override Task HandleAsync(Search req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}
