using RequestBench.Domain;
using RequestBench.Hosts;
using Microsoft.AspNetCore.OutputCaching;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// cache: ASP.NET Core's own output caching. The response is stored whole and replayed
/// before the endpoint is reached, which is why x-rb-serial repeats across a run.
///
/// CacheOutput names the policy, and the policy is where the key is decided:
/// SetVaryByHeader on the vary rows, path alone on the rest. Registered in
/// <see cref="Caching.AddRequestBenchOutputCache"/> so five targets size one store the
/// same way.
/// </summary>
public static class Cache
{
    // rb:wiring cache.*
    private static Func<HttpResponse, DomainModel, PayloadBody> Serve(
        string size, string[]? vary = null) =>
        (response, model) =>
        {
            if (vary is not null)
            {
                response.Headers.Vary = string.Join(", ", vary);
            }
            response.Headers["x-rb-serial"] = model.NextSerial();
            return model.Payload(size);
        };

    public static void Map(WebApplication app, DomainModel model)
    {
        // rb:handler cache.small,cache.medium,cache.large
        foreach (string size in new[] { "small", "medium", "large" })
        {
            app.MapGet("/cache/" + size, Serve(size)).CacheOutput(Caching.ByPath);
        }

        // rb:handler cache.vary_one,cache.vary_many
        foreach (string which in new[] { "one", "many" })
        {
            string[] on = model.VaryOn(which);
            app.MapGet("/cache/vary/" + which, Serve("small", on))
               .CacheOutput(Caching.VaryPolicy(which));
        }
    }
}
