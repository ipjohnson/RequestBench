using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// parameters: router captures, each bound onto the request type's property of the same name,
/// as the integer its type says. Routing prefers the literal segment of the static route.
/// </summary>
// rb:handler parameters.static
public sealed class ParametersStaticEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/parameters/static/segment/literal");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:handler parameters.one
public sealed class ParametersOneEndpoint(Payloads payloads) : Endpoint<ParametersOne, Echoed<ParametersOne>>
{
    public override void Configure() => Get("/parameters/{one}/segment/literal");

    public override Task HandleAsync(ParametersOne req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}

// rb:handler parameters.two
public sealed class ParametersTwoEndpoint(Payloads payloads) : Endpoint<ParametersTwo, Echoed<ParametersTwo>>
{
    public override void Configure() => Get("/parameters/{one}/with-second/{two}");

    public override Task HandleAsync(ParametersTwo req, CancellationToken ct) => Send.OkAsync(new(payloads.Small, req), ct);
}
