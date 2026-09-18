using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// headers: the request header map at five and at thirty headers, left unread and with three
/// of them bound and echoed.
///
/// Headers reads no header at all, so headers.many minus headers.few is the cost of 25 more
/// headers that nobody asked for. Bind binds three by declaring them on the endpoint method:
/// [FromHeader] names the header, and the parameter's type is the conversion Wolverine
/// generates into the endpoint before the method runs.
///
/// The parameters are not nullable and carry no default, so what a missing or unconvertible
/// one is stays Wolverine's decision. The endpoint set sends neither.
/// </summary>
public static class HeadersEndpoints
{
    [WolverineGet("/headers")]
    public static PayloadBody Headers(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/headers/bind")]
    public static PayloadWithEcho Bind([FromHeader(Name = "x-rb-tenant")] string tenant,
                                       [FromHeader(Name = "x-rb-request-id")] string requestId,
                                       [FromHeader(Name = "x-rb-account")] int account,
                                       DomainModel domain) =>
        domain.WithEcho("small", new { tenant, requestId, account });
}
