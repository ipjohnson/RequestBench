using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// cache: ASP.NET Core's own output caching. The response is stored whole and replayed
/// before the action is reached, which is why x-rb-serial repeats across a run.
///
/// OutputCache names the policy, and the policy is where the key is decided. MVC takes it
/// as an attribute, which is the same registration every .NET target opts into by a
/// different spelling.
/// </summary>
[ApiController]
public sealed class CacheController(DomainModel domain) : ControllerBase
{
    // rb:wiring cache.*
    private IActionResult Serve(string size, string? which = null)
    {
        if (which is not null)
        {
            Response.Headers.Vary = string.Join(", ", domain.VaryOn(which));
        }
        Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Ok(domain.Payload(size));
    }

    // rb:handler cache.small,cache.medium,cache.large
    [HttpGet("/cache/small")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public IActionResult Small() => Serve("small");

    [HttpGet("/cache/medium")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public IActionResult Medium() => Serve("medium");

    [HttpGet("/cache/large")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public IActionResult Large() => Serve("large");

    // rb:handler cache.vary_one,cache.vary_many
    [HttpGet("/cache/vary/one")]
    [OutputCache(PolicyName = Caching.VaryOne)]
    public IActionResult VaryOne() => Serve("small", "one");

    [HttpGet("/cache/vary/many")]
    [OutputCache(PolicyName = Caching.VaryMany)]
    public IActionResult VaryMany() => Serve("small", "many");
}
