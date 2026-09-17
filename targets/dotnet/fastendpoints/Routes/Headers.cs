using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// headers: eager against lazy construction of the request header map.
///
/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
/// </summary>
// rb:handler headers.few,headers.many
public sealed class HeadersEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/headers");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}
