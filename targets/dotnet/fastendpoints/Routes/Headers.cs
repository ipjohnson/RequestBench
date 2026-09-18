using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// headers: the request header map at five and at thirty headers, left unread and with three
/// of them bound and echoed.
///
/// HeadersEndpoint reads no header at all, so headers.many minus headers.few is the cost of 25
/// more headers that nobody asked for. HeadersBindEndpoint binds three into a request DTO:
/// [FromHeader] names the header a property is filled from, and the property's type is the
/// conversion FastEndpoints runs before ExecuteAsync does.
///
/// [FromHeader] makes each header required, so FastEndpoints decides what a missing or
/// unconvertible one is. The endpoint set sends neither.
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

public sealed class HeadersBindRequest
{
    [FromHeader("x-rb-tenant")]
    public string Tenant { get; set; } = string.Empty;

    [FromHeader("x-rb-request-id")]
    public string RequestId { get; set; } = string.Empty;

    [FromHeader("x-rb-account")]
    public int Account { get; set; }
}

// rb:handler headers.bind_few,headers.bind_many
public sealed class HeadersBindEndpoint(DomainModel domain)
    : Endpoint<HeadersBindRequest, PayloadWithEcho>
{
    public override void Configure()
    {
        Get("/headers/bind");
        AllowAnonymous();
    }

    public override Task<PayloadWithEcho> ExecuteAsync(HeadersBindRequest req,
                                                       CancellationToken ct) =>
        Task.FromResult(domain.WithEcho("small", new { req.Tenant, req.RequestId, req.Account }));
}
