using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// json: the serializer and response buffering across three size regimes.
///
/// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route.
/// </summary>
// rb:handler json.small
public sealed class JsonSmallEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/json/small");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}

// rb:handler json.medium
public sealed class JsonMediumEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/json/medium");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("medium"));
}

// rb:handler json.large
public sealed class JsonLargeEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/json/large");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("large"));
}
