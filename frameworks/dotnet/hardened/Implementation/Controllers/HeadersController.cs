using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three by declaring them on the
/// handler, account as an integer.
/// </summary>
public static class HeadersController
{
    [Get("/headers")]
    public static Payload Unread(IPayloads p) => p.Small;

    [Get("/headers/bind")]
    public static Echoed<HeadersBound> Bind(
        IPayloads p,
        [FromHeader("x-rb-tenant")] string tenant,
        [FromHeader("x-rb-request-id")] string requestId,
        [FromHeader("x-rb-account")] int account) =>
        new(p.Small, new(tenant, requestId, account));
}
