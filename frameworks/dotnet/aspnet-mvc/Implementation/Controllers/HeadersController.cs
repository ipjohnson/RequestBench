using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// headers: /headers reads no header, and /headers/bind binds three by declaring them on the
/// action, account as an integer.
/// </summary>
[ApiController]
public sealed class HeadersController(Payloads payloads) : ControllerBase
{
    [HttpGet("/headers")]
    public Payload Unread() => payloads.Small;

    [HttpGet("/headers/bind")]
    public Echoed<HeadersBound> Bind([FromHeader(Name = "x-rb-tenant")] string tenant,
                                     [FromHeader(Name = "x-rb-request-id")] string requestId,
                                     [FromHeader(Name = "x-rb-account")] int account) =>
        new(payloads.Small, new(tenant, requestId, account));
}
