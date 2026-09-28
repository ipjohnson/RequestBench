using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Implementation.Controllers;

/// <summary>
/// cache: ASP.NET Core's output caching, which MVC reads from [OutputCache] on the action. It
/// stores the whole answer and replays it before the action is reached. The action writes
/// x-rb-serial, so a replayed answer repeats the serial it was stored with. Each action's
/// attribute sets how long an answer is kept, and a vary action's names the headers its key adds.
/// </summary>
[ApiController]
public sealed class CacheController(Payloads payloads) : ControllerBase
{
    [HttpGet("/cache/small/{key}")]
    [OutputCache(Duration = 30)]
    public Payload Small() => Stored(payloads.Small);

    [HttpGet("/cache/medium/{key}")]
    [OutputCache(Duration = 30)]
    public Payload Medium() => Stored(payloads.Medium);

    [HttpGet("/cache/large/{key}")]
    [OutputCache(Duration = 30)]
    public Payload Large() => Stored(payloads.Large);

    [HttpGet("/cache/vary/one/{key}")]
    [OutputCache(Duration = 30, VaryByHeaderNames = ["x-rb-tenant"])]
    public Payload VaryOne() => Stored(payloads.Small, "x-rb-tenant");

    [HttpGet("/cache/vary/many/{key}")]
    [OutputCache(Duration = 30, VaryByHeaderNames = ["x-rb-channel", "x-rb-region", "x-rb-tenant"])]
    public Payload VaryMany() => Stored(payloads.Small, "x-rb-channel, x-rb-region, x-rb-tenant");

    /// <summary>
    /// The Vary header tells a cache in front of the framework what the answer depends on.
    /// The output cache keys on its policy, not on this header.
    /// </summary>
    private Payload Stored(Payload payload, string? vary = null)
    {
        Serial.Write(Response);
        if (vary is not null)
        {
            Response.Headers.Vary = vary;
        }
        return payload;
    }
}
