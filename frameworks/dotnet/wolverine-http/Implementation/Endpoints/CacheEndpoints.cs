using Microsoft.AspNetCore.OutputCaching;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// cache: ASP.NET Core's output caching, which stores the whole answer and replays it before
/// the handler is reached. Wolverine copies [OutputCache] onto the route, and the policy it names
/// sets how long an answer is kept and, on a vary route, adds the row's headers to the key. The
/// handler writes x-rb-serial, so a replayed answer repeats the serial it was stored with.
/// </summary>
public static class CacheEndpoints
{
    [WolverineGet("/cache/small")]
    [OutputCache(PolicyName = Policies.Stored)]
    public static Payload Small(HttpResponse response, Payloads p) => Stored(response, p.Small);

    [WolverineGet("/cache/medium")]
    [OutputCache(PolicyName = Policies.Stored)]
    public static Payload Medium(HttpResponse response, Payloads p) => Stored(response, p.Medium);

    [WolverineGet("/cache/large")]
    [OutputCache(PolicyName = Policies.Stored)]
    public static Payload Large(HttpResponse response, Payloads p) => Stored(response, p.Large);

    [WolverineGet("/cache/vary/one")]
    [OutputCache(PolicyName = Policies.VaryOne)]
    public static Payload VaryOne(HttpResponse response, Payloads p) => Stored(response, p.Small, p.Settings.Cache.Vary.One.Keys);

    [WolverineGet("/cache/vary/many")]
    [OutputCache(PolicyName = Policies.VaryMany)]
    public static Payload VaryMany(HttpResponse response, Payloads p) => Stored(response, p.Small, p.Settings.Cache.Vary.Many.Keys);

    /// <summary>
    /// The Vary header tells a cache in front of the framework what the answer depends on.
    /// The output cache keys on its policy, not on this header.
    /// </summary>
    private static Payload Stored(HttpResponse response, Payload payload, IEnumerable<string>? vary = null)
    {
        Serial.Write(response);
        if (vary is not null)
        {
            response.Headers.Vary = string.Join(", ", vary);
        }
        return payload;
    }
}
