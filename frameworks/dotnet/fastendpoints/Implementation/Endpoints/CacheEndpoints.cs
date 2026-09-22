using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// cache: ASP.NET Core's output caching, which stores the whole answer and replays it before
/// the endpoint is reached. FastEndpoints' own ResponseCache() only writes Cache-Control, so
/// each endpoint adds the output cache through its route builder. The handler writes
/// x-rb-serial, so a replayed answer repeats the serial it was stored with. A vary route's
/// policy adds its headers to the key.
/// </summary>
// rb:handler cache.small
public sealed class CacheSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/small");
        Options(b => b.CacheOutput());
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Small, ct);
    }
}

// rb:handler cache.medium
public sealed class CacheMediumEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/medium");
        Options(b => b.CacheOutput());
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Medium, ct);
    }
}

// rb:handler cache.large
public sealed class CacheLargeEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/large");
        Options(b => b.CacheOutput());
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Large, ct);
    }
}

// rb:handler cache.vary_one
public sealed class CacheVaryOneEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/vary/one");
        Options(b => b.CacheOutput(policy => policy.SetVaryByHeader([.. payloads.Settings.Cache.Vary.One.Keys])));
    }

    // The Vary header tells a cache in front of the framework what the answer depends on.
    // The output cache keys on its policy, not on this header.
    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        HttpContext.Response.Headers.Vary = string.Join(", ", payloads.Settings.Cache.Vary.One.Keys);
        return Send.OkAsync(payloads.Small, ct);
    }
}

// rb:handler cache.vary_many
public sealed class CacheVaryManyEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/vary/many");
        Options(b => b.CacheOutput(policy => policy.SetVaryByHeader([.. payloads.Settings.Cache.Vary.Many.Keys])));
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        HttpContext.Response.Headers.Vary = string.Join(", ", payloads.Settings.Cache.Vary.Many.Keys);
        return Send.OkAsync(payloads.Small, ct);
    }
}
