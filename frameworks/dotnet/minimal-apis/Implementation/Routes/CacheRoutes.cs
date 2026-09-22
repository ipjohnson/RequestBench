namespace Implementation.Routes;

/// <summary>
/// cache: ASP.NET Core's output caching, which stores the whole answer and replays it before
/// the handler is reached. The handler writes x-rb-serial, so a replayed answer repeats the
/// serial it was stored with. A vary route's policy adds its headers to the key.
/// </summary>
public static class CacheRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        VarySettings vary = app.ServiceProvider.GetRequiredService<Payloads>().Settings.Cache.Vary;

        app.MapGet("/cache/small", (HttpResponse response, Payloads p) => Stored(response, p.Small)).CacheOutput().DisableValidation();

        app.MapGet("/cache/medium", (HttpResponse response, Payloads p) => Stored(response, p.Medium)).CacheOutput().DisableValidation();

        app.MapGet("/cache/large", (HttpResponse response, Payloads p) => Stored(response, p.Large)).CacheOutput().DisableValidation();

        string[] one = [.. vary.One.Keys];
        app.MapGet("/cache/vary/one", (HttpResponse response, Payloads p) => Stored(response, p.Small, one))
           .CacheOutput(policy => policy.SetVaryByHeader(one))
           .DisableValidation();

        string[] many = [.. vary.Many.Keys];
        app.MapGet("/cache/vary/many", (HttpResponse response, Payloads p) => Stored(response, p.Small, many))
           .CacheOutput(policy => policy.SetVaryByHeader(many))
           .DisableValidation();
    }

    /// <summary>
    /// The Vary header tells a cache in front of the framework what the answer depends on.
    /// The output cache keys on its policy, not on this header.
    /// </summary>
    private static Payload Stored(HttpResponse response, Payload payload, string[]? vary = null)
    {
        Serial.Write(response);
        if (vary is not null)
        {
            response.Headers.Vary = string.Join(", ", vary);
        }
        return payload;
    }
}
