using Carter;

namespace Implementation.Routes;

/// <summary>
/// cache: ASP.NET Core's output caching, which stores the whole answer and replays it before
/// the handler is reached. The handler writes x-rb-serial, so a replayed answer repeats the
/// serial it was stored with. A vary route's policy adds its headers to the key.
/// </summary>
public sealed class CacheRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        // Each handler binds the key, which is how the OpenAPI document learns the route has one.
        app.MapGet("/cache/small/{key}", (string key, HttpResponse response, Payloads p) => Stored(response, p.Small))
           .CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)));

        app.MapGet("/cache/medium/{key}", (string key, HttpResponse response, Payloads p) => Stored(response, p.Medium))
           .CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)));

        app.MapGet("/cache/large/{key}", (string key, HttpResponse response, Payloads p) => Stored(response, p.Large))
           .CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)));

        app.MapGet("/cache/vary/one/{key}", (string key, HttpResponse response, Payloads p) => Stored(response, p.Small, "x-rb-tenant"))
           .CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)).SetVaryByHeader("x-rb-tenant"));

        app.MapGet("/cache/vary/many/{key}", (string key, HttpResponse response, Payloads p) => Stored(response, p.Small, "x-rb-channel, x-rb-region, x-rb-tenant"))
           .CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)).SetVaryByHeader("x-rb-channel", "x-rb-region", "x-rb-tenant"));
    }

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
