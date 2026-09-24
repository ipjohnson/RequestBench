using System.IO.Compression;
using System.Text.Json.Serialization.Metadata;
using DependencyModules.Runtime.Interfaces;
using Hardened.Requests.Caching.Memory;
using Hardened.Requests.Runtime.Caching;
using Hardened.Requests.Runtime.Filters;
using Hardened.Shared.Runtime.Attributes;
using Hardened.Templates.RazorBlade;
using Hardened.Web.Runtime.Attributes;
using Hardened.Web.Runtime.Caching;
using Hardened.Web.Runtime.Compression;
using Hardened.Web.Runtime.Cors;
using Hardened.Web.Runtime.DependencyInjection;
using Hardened.Web.Runtime.OpenApi;
using Hardened.Web.StaticContent;
using Microsoft.Extensions.DependencyInjection;

namespace Implementation;

/// <summary>
/// The library module: every route in this project, and what their families register. Each host's
/// project imports it with [ImplementationLibrary] beside the host's own attribute, and the tests
/// build it alone.
/// </summary>
[HardenedModule]
[HardenedWebModule]
// Serves the document the build writes from these routes. HardenedOpenApiOutput reads it out of
// the assembly for Client/.
[Enable<OpenApiDocumentPublishing>]
// rb:wiring template.*
[Enable<RazorTemplates>]
// rb:end
// rb:wiring cache.*
[HardenedMemoryResponseCache]
// rb:end
// rb:wiring static.*
[HardenedStaticContent]
// rb:end
public partial class ImplementationLibrary : IEnvironmentServiceCollectionConfiguration
{
    public void ConfigureServices(IServiceCollection services, IModuleEnvironment environment)
    {
        Payloads payloads = Payloads.Load(environment.Value("RB_PAYLOADS")
            ?? throw new InvalidOperationException("RB_PAYLOADS has to name the payload directory"));
        Settings settings = payloads.Settings;

        services.AddSingleton(payloads);
        // rb:wiring json.*
        services.AddSingleton<IJsonTypeInfoResolver>(JsonContext.Default);
        // rb:wiring cache.*
        // Put on the cache routes here rather than written as [CacheResponse] on each, because an
        // attribute's lifetime and header names are constants, and these come from settings.json.
        // VaryByHeader keys an entry on the headers it names and adds them to Vary.
        int ttl = settings.Cache.TtlSeconds;
        string[] byRoute = [Routes.CacheRoutes.Small(), Routes.CacheRoutes.Medium(), Routes.CacheRoutes.Large()];
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByRoute> { Duration = ttl },
            when: handler => byRoute.Contains(handler.Path));
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByHeader>([.. settings.Cache.Vary.One.Keys]) { Duration = ttl },
            when: handler => handler.Path == Routes.CacheRoutes.VaryOne());
        services.AddGlobalFilter(new CacheResponseAttribute<VaryByHeader>([.. settings.Cache.Vary.Many.Keys]) { Duration = ttl },
            when: handler => handler.Path == Routes.CacheRoutes.VaryMany());
        // rb:end
        // rb:wiring compressed.*
        // Fastest is already the default, and every framework here compresses at its fastest
        // level, so this says so rather than leaving it to a default.
        services.ConfigureCompression(compression => compression.Level = CompressionLevel.Fastest);
        // rb:wiring cors.*
        services.AddCorsPolicy<Shop>(policy =>
        {
            policy.AllowOrigin(settings.Cors.Origin);
            policy.AllowHeader(settings.Cors.Header);
            policy.MaxAgeSec = settings.Cors.MaxAgeSeconds;
        });
        // rb:wiring static.*
        services.ConfigureStaticContent(content => content.Path = payloads.Directory);
        services.AddSingleton<IStaticContentSource>(provider =>
            new UnderStatic(ActivatorUtilities.CreateInstance<FileSystemContentSource>(provider)));
        // rb:end
    }
}
