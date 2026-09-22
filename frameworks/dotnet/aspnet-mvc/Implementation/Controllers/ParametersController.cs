using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// parameters: route values, each bound by naming an action parameter after it, as the integer
/// its type says. Routing prefers the literal segment of the static route.
/// </summary>
[ApiController]
public sealed class ParametersController(Payloads payloads) : ControllerBase
{
    [HttpGet("/parameters/static/segment/literal")]
    public Payload Literal() => payloads.Small;

    [HttpGet("/parameters/{one}/segment/literal")]
    public Echoed<ParametersOne> One(int one) => new(payloads.Small, new(one));

    [HttpGet("/parameters/{one}/with-second/{two}")]
    public Echoed<ParametersTwo> Two(int one, int two) => new(payloads.Small, new(one, two));
}
