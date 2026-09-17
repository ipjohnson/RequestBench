using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>parameters: router captures with segment depth held constant.</summary>
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

// rb:handler parameters.one
public sealed class ParametersOneEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/parameters/{one}");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}

// rb:handler parameters.two
public sealed class ParametersTwoEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/parameters/{one}/with-second/{two}");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}
