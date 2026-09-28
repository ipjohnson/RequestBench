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
        Get("/cache/small/{key}");
        Options(b => b.CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30))));
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
        Get("/cache/medium/{key}");
        Options(b => b.CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30))));
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
        Get("/cache/large/{key}");
        Options(b => b.CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30))));
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
        Get("/cache/vary/one/{key}");
        Options(b => b.CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)).SetVaryByHeader("x-rb-tenant")));
    }

    // The Vary header tells a cache in front of the framework what the answer depends on.
    // The output cache keys on its policy, not on this header.
    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        HttpContext.Response.Headers.Vary = "x-rb-tenant";
        return Send.OkAsync(payloads.Small, ct);
    }
}

// rb:handler cache.vary_many
public sealed class CacheVaryManyEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cache/vary/many/{key}");
        Options(b => b.CacheOutput(policy => policy.Expire(TimeSpan.FromSeconds(30)).SetVaryByHeader("x-rb-channel", "x-rb-region", "x-rb-tenant")));
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        HttpContext.Response.Headers.Vary = "x-rb-channel, x-rb-region, x-rb-tenant";
        return Send.OkAsync(payloads.Small, ct);
    }
}
