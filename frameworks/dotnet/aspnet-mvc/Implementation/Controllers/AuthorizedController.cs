using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// authorized: ASP.NET Core's authorization, which MVC reads from [Authorize] on the action. The
/// token policy runs before the action and forbids a token that is not settings.json's.
/// </summary>
[ApiController]
public sealed class AuthorizedController(Payloads payloads) : ControllerBase
{
    [HttpGet("/authorized/small")]
    [Authorize(Policy = Policies.Token)]
    public Payload Small() => payloads.Small;
}
