using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// authorized: ASP.NET Core's authorization, which MVC reads from [Authorize] on the action. The
/// token policy runs before the action and forbids any token but the one it names.
/// </summary>
[ApiController]
public sealed class AuthorizedController(Payloads payloads) : ControllerBase
{
    [HttpGet("/authorized/small")]
    [Authorize(Policy = Policies.Token)]
    public Payload Small() => payloads.Small;
}
