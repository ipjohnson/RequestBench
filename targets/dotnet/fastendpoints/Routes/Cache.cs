using FastEndpoints;
using Microsoft.AspNetCore.OutputCaching;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// cache: ASP.NET Core's own output caching. The response is stored whole and replayed
/// before the endpoint is reached, which is why x-rb-serial repeats across a run.
///
/// FastEndpoints' own ResponseCache() writes Cache-Control for the client and stores
/// nothing, so the server-side half is Options(b => b.CacheOutput(...)), which is the
/// framework handing the endpoint's builder to the same registration every .NET target uses.
/// </summary>
public abstract class CacheEndpoint(DomainModel domain, string size, string? which)
    : EndpointWithoutRequest
{
    public override Task<object?> ExecuteAsync(CancellationToken ct)
    {
        if (which is not null)
        {
            HttpContext.Response.Headers.Vary = string.Join(", ", domain.VaryOn(which));
        }
        HttpContext.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Task.FromResult<object?>(domain.Payload(size));
    }
}

// rb:snippet cache.small cache.medium cache.large
public sealed class CacheSmallEndpoint(DomainModel domain) : CacheEndpoint(domain, "small", null)
{
    public override void Configure()
    {
        Get("/cache/small");
        AllowAnonymous();
        Options(b => b.CacheOutput(Caching.ByPath));
    }
}

public sealed class CacheMediumEndpoint(DomainModel domain) : CacheEndpoint(domain, "medium", null)
{
    public override void Configure()
    {
        Get("/cache/medium");
        AllowAnonymous();
        Options(b => b.CacheOutput(Caching.ByPath));
    }
}

public sealed class CacheLargeEndpoint(DomainModel domain) : CacheEndpoint(domain, "large", null)
{
    public override void Configure()
    {
        Get("/cache/large");
        AllowAnonymous();
        Options(b => b.CacheOutput(Caching.ByPath));
    }
}

// rb:snippet cache.vary_one cache.vary_many
public sealed class CacheVaryOneEndpoint(DomainModel domain) : CacheEndpoint(domain, "small", "one")
{
    public override void Configure()
    {
        Get("/cache/vary/one");
        AllowAnonymous();
        Options(b => b.CacheOutput(Caching.VaryPolicy("one")));
    }
}

public sealed class CacheVaryManyEndpoint(DomainModel domain) : CacheEndpoint(domain, "small", "many")
{
    public override void Configure()
    {
        Get("/cache/vary/many");
        AllowAnonymous();
        Options(b => b.CacheOutput(Caching.VaryPolicy("many")));
    }
}
