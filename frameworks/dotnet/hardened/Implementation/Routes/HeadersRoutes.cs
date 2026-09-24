using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three by declaring them on the
/// handler, account as an integer.
/// </summary>
public class HeadersRoutes(Payloads payloads)
{
    [Get("/headers")]
    public Payload Headers() => payloads.Small;

    [Get("/headers/bind")]
    public Echoed<HeadersBound> Bind([FromHeader("x-rb-tenant")] string tenant,
                                     [FromHeader("x-rb-request-id")] string requestId,
                                     [FromHeader("x-rb-account")] int account) =>
        new(payloads.Small, new(tenant, requestId, account));
}
