using Microsoft.AspNetCore.Mvc;

namespace Implementation.Routes;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three by declaring them on the
/// handler, account as an integer.
/// </summary>
public static class HeadersRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/headers", (Payloads p) => p.Small);

        app.MapGet("/headers/bind", ([FromHeader(Name = "x-rb-tenant")] string tenant,
                                     [FromHeader(Name = "x-rb-request-id")] string requestId,
                                     [FromHeader(Name = "x-rb-account")] int account,
                                     Payloads p) =>
            new Echoed<HeadersBound>(p.Small, new(tenant, requestId, account)));
    }
}
