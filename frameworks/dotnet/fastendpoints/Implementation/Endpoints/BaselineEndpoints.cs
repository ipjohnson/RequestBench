using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>baseline: the dispatch floor, with nothing serialised.</summary>
// rb:handler baseline.plaintext
public sealed class PlaintextEndpoint : EndpointWithoutRequest
{
    public override void Configure() => Get("/plaintext");

    public override Task HandleAsync(CancellationToken ct) => Send.StringAsync("Hello, World!", cancellation: ct);
}
