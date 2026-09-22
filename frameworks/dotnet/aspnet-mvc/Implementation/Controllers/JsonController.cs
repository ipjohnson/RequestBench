using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>json: a payload the framework already holds, serialised at three sizes.</summary>
[ApiController]
public sealed class JsonController(Payloads payloads) : ControllerBase
{
    [HttpGet("/json/small")]
    public Payload Small() => payloads.Small;

    [HttpGet("/json/medium")]
    public Payload Medium() => payloads.Medium;

    [HttpGet("/json/large")]
    public Payload Large() => payloads.Large;
}
