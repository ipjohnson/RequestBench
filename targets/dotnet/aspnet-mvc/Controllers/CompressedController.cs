using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// Scoped to these three actions. ASP.NET's response compression middleware sits on the
/// application, which would put a "did the client ask?" check on all forty-five endpoints
/// and contaminate the rows this family is measured against, which is the whole reason they
/// have their own paths instead of riding on /json with an accept-encoding header.
///
/// The codec and the floor are the pinned ones every language shares.
/// </summary>
[ApiController]
public sealed class CompressedController(DomainModel domain) : ControllerBase
{
    // rb:wiring compressed.*
    private IActionResult Serve(string size)
    {
        Response.Headers["x-rb-serial"] = domain.NextSerial();
        byte[] raw = Json.Bytes(domain.Payload(size));
        string accept = Request.Headers.AcceptEncoding.ToString();
        if (!accept.Contains("gzip", StringComparison.Ordinal)
            || raw.Length < DomainModel.GzipMinSize)
        {
            return File(raw, "application/json");
        }
        Response.Headers.ContentEncoding = "gzip";
        Response.Headers.Vary = "Accept-Encoding";
        return File(DomainModel.Gzip(raw), "application/json");
    }

    [HttpGet("/compressed/small")]
    public IActionResult Small() => Serve("small");

    [HttpGet("/compressed/medium")]
    public IActionResult Medium() => Serve("medium");

    [HttpGet("/compressed/large")]
    public IActionResult Large() => Serve("large");
}
