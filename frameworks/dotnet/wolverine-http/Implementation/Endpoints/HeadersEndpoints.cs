using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three with [FromHeader], account
/// as an integer.
/// </summary>
public static class HeadersEndpoints
{
    [WolverineGet("/headers")]
    public static Payload Unread(Payloads p) => p.Small;

    [WolverineGet("/headers/bind")]
    public static Echoed<HeadersBound> Bind([FromHeader(Name = "x-rb-tenant")] string tenant,
                                            [FromHeader(Name = "x-rb-request-id")] string requestId,
                                            [FromHeader(Name = "x-rb-account")] int account,
                                            Payloads p) =>
        new(p.Small, new(tenant, requestId, account));
}
