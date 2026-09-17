using Carter;
using Microsoft.AspNetCore.OutputCaching;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// cache: ASP.NET Core's own output caching. The response is stored whole and replayed
/// before the handler is reached, which is why x-rb-serial repeats across a run.
///
/// CacheOutput names the policy, and the policy is where the key is decided.
/// </summary>
public sealed class Cache : ICarterModule
{
    private static Func<HttpContext, DomainModel, PayloadBody> Serve(
        string size, string? which = null) =>
        (context, model) =>
        {
            if (which is not null)
            {
                context.Response.Headers.Vary = string.Join(", ", model.VaryOn(which));
            }
            context.Response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        // rb:snippet cache.small cache.medium cache.large
        foreach (string size in new[] { "small", "medium", "large" })
        {
            app.MapGet("/cache/" + size, Serve(size)).CacheOutput(Caching.ByPath);
        }

        // rb:snippet cache.vary_one cache.vary_many
        foreach (string which in new[] { "one", "many" })
        {
            app.MapGet("/cache/vary/" + which, Serve("small", which))
               .CacheOutput(Caching.VaryPolicy(which));
        }
    }
}
