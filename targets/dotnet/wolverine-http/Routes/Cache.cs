using Microsoft.AspNetCore.OutputCaching;
using RequestBench.Domain;
using RequestBench.Hosts;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// cache: ASP.NET Core's own output caching. The response is stored whole and replayed
/// before the endpoint is reached, which is why x-rb-serial repeats across a run.
///
/// Wolverine builds its routes from the attributes on the method rather than from a map
/// call, and it carries the rest of a method's attributes onto the endpoint's metadata, so
/// OutputCache goes here beside WolverineGet. The policy is still where the key is decided.
/// </summary>
public static class CacheEndpoints
{
    private static PayloadBody Serve(HttpContext context, DomainModel domain,
                                     string size, string? which = null)
    {
        if (which is not null)
        {
            context.Response.Headers.Vary = string.Join(", ", domain.VaryOn(which));
        }
        context.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return domain.Payload(size);
    }

    // rb:snippet cache.small cache.medium cache.large
    [WolverineGet("/cache/small")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public static PayloadBody Small(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small");

    [WolverineGet("/cache/medium")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public static PayloadBody Medium(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "medium");

    [WolverineGet("/cache/large")]
    [OutputCache(PolicyName = Caching.ByPath)]
    public static PayloadBody Large(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "large");

    // rb:snippet cache.vary_one cache.vary_many
    [WolverineGet("/cache/vary/one")]
    [OutputCache(PolicyName = Caching.VaryOne)]
    public static PayloadBody VaryOne(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small", "one");

    [WolverineGet("/cache/vary/many")]
    [OutputCache(PolicyName = Caching.VaryMany)]
    public static PayloadBody VaryMany(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small", "many");
}
