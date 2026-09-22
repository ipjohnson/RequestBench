using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>json: a payload the framework already holds, serialised at three sizes.</summary>
// rb:handler json.small,cors.scoped
public sealed class JsonSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/json/small");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:handler json.medium
public sealed class JsonMediumEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/json/medium");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Medium, ct);
}

// rb:handler json.large
public sealed class JsonLargeEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/json/large");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Large, ct);
}
