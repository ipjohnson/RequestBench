using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// These actions answer like any other. The response compression middleware that Program.cs
/// installs on the whole application gzips the answer when the request asks for it, at the
/// provider's default level, Fastest, with no minimum size.
/// </summary>
[ApiController]
public sealed class CompressedController(DomainModel domain) : ControllerBase
{
    // rb:wiring compressed.*
    private IActionResult Serve(string size)
    {
        Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Ok(domain.Payload(size));
    }

    [HttpGet("/compressed/small")]
    public IActionResult Small() => Serve("small");

    [HttpGet("/compressed/medium")]
    public IActionResult Medium() => Serve("medium");

    [HttpGet("/compressed/large")]
    public IActionResult Large() => Serve("large");
}
