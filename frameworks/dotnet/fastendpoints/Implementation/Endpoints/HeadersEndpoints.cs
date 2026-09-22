using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three into its request type,
/// where [FromHeader] names each one and account binds as an integer.
/// </summary>
// rb:handler headers.few,headers.many
public sealed class HeadersEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/headers");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:handler headers.bind_few,headers.bind_many
public sealed class HeadersBindEndpoint(Payloads payloads) : Endpoint<HeadersBound, Echoed<HeadersBound>>
{
    public override void Configure() => Get("/headers/bind");

    public override Task HandleAsync(HeadersBound req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}
