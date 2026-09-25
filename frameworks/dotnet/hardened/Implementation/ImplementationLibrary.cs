using System.IO.Compression;
using System.Text.Json.Serialization.Metadata;
using DependencyModules.Runtime.Interfaces;
using Hardened.Requests.Caching.Memory;
using Hardened.Requests.Runtime.Caching;
using Hardened.Requests.Runtime.Filters;
using Hardened.Shared.Runtime.Attributes;
using Hardened.Templates.RazorBlade;
using Hardened.Web.Runtime.Caching;
using Hardened.Web.Runtime.Compression;
using Hardened.Web.Runtime.Cors;
using Hardened.Web.Runtime.DependencyInjection;
using Hardened.Web.Runtime.OpenApi;
using Hardened.Web.StaticContent;
using Microsoft.Extensions.DependencyInjection;

namespace Implementation;

/// <summary>
/// The library module: every route in this assembly and the services they use. Each host's
/// Application imports it with [ImplementationLibrary], under that host's own attribute.
/// </summary>
[HardenedModule]
[HardenedWebModule]
// The document the build writes to Client/openapi.json. The application also serves it at
// /openapi.json, because the file is read out of the served copy.
[Enable<OpenApiDocumentPublishing>]
// rb:wiring template.*
[Enable<RazorTemplates>]
// rb:end
// rb:wiring cache.*
[HardenedMemoryResponseCache]
// rb:end
// rb:wiring static.*
[HardenedStaticContent(RoutePrefix = "/static")]
// rb:end
public partial class ImplementationLibrary : IEnvironmentServiceCollectionConfiguration
{
    /// <remarks>
    /// The environment is Hardened's, which reads the process's variables in a host and the values a
    /// test declares in a test. The payloads load here, before any host starts, because the cache,
    /// CORS and static content settings below are read from them.
    /// </remarks>
    public void ConfigureServices(IServiceCollection services, IModuleEnvironment environment)
    {
        Payloads payloads = Payloads.Load(environment.Value("RB_PAYLOADS")
            ?? throw new InvalidOperationException("RB_PAYLOADS has to name the payload directory"));
        Settings settings = payloads.Settings;
        services.AddSingleton<IPayloads>(payloads);

        // rb:wiring json.*
        services.AddSingleton<IJsonTypeInfoResolver>(JsonContext.Default);

        // rb:wiring cache.*
        // [CacheResponse<T>] takes its lifetime and key values as attribute constants, so the cache
        // routes get them from settings.json through AddGlobalFilter, which is how Hardened applies
        // values from configuration. VaryByHeader keys the entry on each header it names and writes
        // them into the answer's Vary.
        int seconds = settings.Cache.TtlSeconds;
        string[] byPath = [Routes.Cache.Small(), Routes.Cache.Medium(), Routes.Cache.Large()];
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByRoute> { Duration = seconds },
            handler => byPath.Contains(handler.Path));
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByHeader>([.. settings.Cache.Vary.One.Keys]) { Duration = seconds },
            handler => handler.Path == Routes.Cache.VaryOne());
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByHeader>([.. settings.Cache.Vary.Many.Keys]) { Duration = seconds },
            handler => handler.Path == Routes.Cache.VaryMany());
        // rb:end

        // rb:wiring cors.*
        // The policy [Cors<Shop>] names. Hardened answers a preflight with the method the route
        // declares, so the policy lists no method of its own.
        services.AddCorsPolicy<Shop>(policy =>
        {
            policy.AllowOrigin(settings.Cors.Origin);
            policy.AllowHeader(settings.Cors.Header);
            policy.MaxAgeSec = settings.Cors.MaxAgeSeconds;
        });

        // rb:wiring compressed.*
        // Fastest is already Hardened's level. It is written here so the route does not rest on a
        // default.
        services.ConfigureCompression(compression => compression.Level = CompressionLevel.Fastest);

        // rb:handler static.file
        // rb:wiring static.*
        // The attribute's Path is a constant, so the directory RB_PAYLOADS names is set here.
        services.ConfigureStaticContent(content => content.Path = payloads.Directory);
    }
}

/// <summary>Names the one CORS policy, which only the /cors routes carry.</summary>
public sealed class Shop;
