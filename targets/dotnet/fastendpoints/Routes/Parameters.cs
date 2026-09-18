using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// parameters: router captures with segment depth held constant, each bound as an integer
/// and echoed.
///
/// The captures bind into a request DTO: FastEndpoints fills a property from the route value
/// of the same name, converted to the property's type, before ExecuteAsync runs. The static
/// path also matches /parameters/{one}/segment/literal, and routing prefers the literal
/// segment whatever order the endpoints are registered in.
/// </summary>
// rb:handler parameters.static
public sealed class ParametersStaticEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/parameters/static/segment/literal");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}

public sealed class ParametersOneRequest
{
    public int One { get; set; }
}

// rb:handler parameters.one
public sealed class ParametersOneEndpoint(DomainModel domain)
    : Endpoint<ParametersOneRequest, PayloadWithEcho>
{
    public override void Configure()
    {
        Get("/parameters/{one}/segment/literal");
        AllowAnonymous();
    }

    public override Task<PayloadWithEcho> ExecuteAsync(ParametersOneRequest req,
                                                       CancellationToken ct) =>
        Task.FromResult(domain.WithEcho("small", new { req.One }));
}

public sealed class ParametersTwoRequest
{
    public int One { get; set; }

    public int Two { get; set; }
}

// rb:handler parameters.two
public sealed class ParametersTwoEndpoint(DomainModel domain)
    : Endpoint<ParametersTwoRequest, PayloadWithEcho>
{
    public override void Configure()
    {
        Get("/parameters/{one}/with-second/{two}");
        AllowAnonymous();
    }

    public override Task<PayloadWithEcho> ExecuteAsync(ParametersTwoRequest req,
                                                       CancellationToken ct) =>
        Task.FromResult(domain.WithEcho("small", new { req.One, req.Two }));
}
