using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Implementation.Controllers;

/// <summary>
/// cache: ASP.NET Core's output caching, which MVC reads from [OutputCache] on the action. It
/// stores the whole answer and replays it before the action is reached. The action writes
/// x-rb-serial, so a replayed answer repeats the serial it was stored with. A vary action names
/// a policy that adds its headers to the key.
/// </summary>
[ApiController]
public sealed class CacheController(Payloads payloads) : ControllerBase
{
    [HttpGet("/cache/small")]
    [OutputCache]
    public Payload Small() => Stored(payloads.Small);

    [HttpGet("/cache/medium")]
    [OutputCache]
    public Payload Medium() => Stored(payloads.Medium);

    [HttpGet("/cache/large")]
    [OutputCache]
    public Payload Large() => Stored(payloads.Large);

    [HttpGet("/cache/vary/one")]
    [OutputCache(PolicyName = Policies.VaryOne)]
    public Payload VaryOne() => Stored(payloads.Small, payloads.Settings.Cache.Vary.One.Keys);

    [HttpGet("/cache/vary/many")]
    [OutputCache(PolicyName = Policies.VaryMany)]
    public Payload VaryMany() => Stored(payloads.Small, payloads.Settings.Cache.Vary.Many.Keys);

    /// <summary>
    /// The Vary header tells a cache in front of the framework what the answer depends on.
    /// The output cache keys on its policy, not on this header.
    /// </summary>
    private Payload Stored(Payload payload, IEnumerable<string>? vary = null)
    {
        Serial.Write(Response);
        if (vary is not null)
        {
            Response.Headers.Vary = string.Join(", ", vary);
        }
        return payload;
    }
}
