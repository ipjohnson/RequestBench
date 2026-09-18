using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// parameters: router captures with segment depth held constant, each bound as an integer
/// and echoed.
///
/// MVC's own model binding: [FromRoute] takes the route value of the parameter's name, and
/// the binder converts it to the declared type before the action runs. The static path also
/// matches /parameters/{one}/segment/literal, and routing prefers the literal segment
/// whatever order the actions are declared in.
/// </summary>
[ApiController]
public sealed class ParametersController(DomainModel domain) : ControllerBase
{
    [HttpGet("/parameters/static/segment/literal")]
    public PayloadBody StaticPath() => domain.Payload("small");

    [HttpGet("/parameters/{one}/segment/literal")]
    public PayloadWithEcho One([FromRoute] int one) => domain.WithEcho("small", new { one });

    [HttpGet("/parameters/{one}/with-second/{two}")]
    public PayloadWithEcho Two([FromRoute] int one, [FromRoute] int two) =>
        domain.WithEcho("small", new { one, two });
}
