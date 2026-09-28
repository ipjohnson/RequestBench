using Microsoft.AspNetCore.OutputCaching;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// cache: ASP.NET Core's output caching, which stores the whole answer and replays it before
/// the handler is reached. Wolverine copies [OutputCache] onto the route, where it sets how long
/// an answer is kept and, on a vary route, names the headers the key adds. The handler writes
/// x-rb-serial, so a replayed answer repeats the serial it was stored with.
/// </summary>
public static class CacheEndpoints
{
    [WolverineGet("/cache/small/{key}")]
    [OutputCache(Duration = 30)]
    public static Payload Small(HttpResponse response, Payloads p) => Stored(response, p.Small);

    [WolverineGet("/cache/medium/{key}")]
    [OutputCache(Duration = 30)]
    public static Payload Medium(HttpResponse response, Payloads p) => Stored(response, p.Medium);

    [WolverineGet("/cache/large/{key}")]
    [OutputCache(Duration = 30)]
    public static Payload Large(HttpResponse response, Payloads p) => Stored(response, p.Large);

    [WolverineGet("/cache/vary/one/{key}")]
    [OutputCache(Duration = 30, VaryByHeaderNames = ["x-rb-tenant"])]
    public static Payload VaryOne(HttpResponse response, Payloads p) => Stored(response, p.Small, "x-rb-tenant");

    [WolverineGet("/cache/vary/many/{key}")]
    [OutputCache(Duration = 30, VaryByHeaderNames = ["x-rb-channel", "x-rb-region", "x-rb-tenant"])]
    public static Payload VaryMany(HttpResponse response, Payloads p) => Stored(response, p.Small, "x-rb-channel, x-rb-region, x-rb-tenant");

    /// <summary>
    /// The Vary header tells a cache in front of the framework what the answer depends on.
    /// The output cache keys on its policy, not on this header.
    /// </summary>
    private static Payload Stored(HttpResponse response, Payload payload, string? vary = null)
    {
        Serial.Write(response);
        if (vary is not null)
        {
            response.Headers.Vary = vary;
        }
        return payload;
    }
}
