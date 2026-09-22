using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// cors: ASP.NET Core's CORS feature, which MVC reads from [EnableCors] on this controller and
/// no other. It answers a preflight before any action runs. The action writes x-rb-serial, so
/// its absence on a preflight shows the feature answered alone.
/// </summary>
[ApiController]
// rb:wiring cors.*
[EnableCors(Policies.Cors)]
// rb:end
public sealed class CorsController(Payloads payloads) : ControllerBase
{
    [HttpGet("/cors/small")]
    public Payload Small()
    {
        Serial.Write(Response);
        return payloads.Small;
    }
}
