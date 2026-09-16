using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// cached: validator headers and the conditional request.
///
/// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
/// rather than hashing the body. The comparison requires a non-empty header: matching a
/// missing if-none-match against an empty ETag answers 304 to a client that never asked a
/// conditional question.
/// </summary>
[ApiController]
public sealed class CachedController(DomainModel domain) : ControllerBase
{
    private IActionResult Serve(string size)
    {
        string etag = domain.ETagOf(size);
        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = DomainModel.Cacheable;
        Response.Headers["x-rb-serial"] = domain.NextSerial();
        string inm = Request.Headers.IfNoneMatch.ToString();
        return inm.Length > 0 && inm == etag
            ? StatusCode(304)
            : Ok(domain.Payload(size));
    }

    [HttpGet("/cached/small")]
    public IActionResult Small() => Serve("small");

    [HttpGet("/cached/medium")]
    public IActionResult Medium() => Serve("medium");

    [HttpGet("/cached/large")]
    public IActionResult Large() => Serve("large");
}
