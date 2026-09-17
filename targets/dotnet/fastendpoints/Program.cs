using FastEndpoints;
using RequestBench.Domain;
using RequestBench.FastEndpointsTarget;
using RequestBench.Hosts;

// RequestBench target: FastEndpoints. Framework wiring only; behaviour from
// RequestBench.Domain.
//
// One file per endpoint family, under Routes/. FastEndpoints wants a class per endpoint, so
// a family file holds the classes for that family; the framework finds them by scanning the
// assembly and nothing here lists them.
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
// ASP.NET Core's own response cache, sized from the fixture. A policy per shape a
// cache.* row is keyed by, which is where the vary rows say what folds into the key.
builder.Services.AddRequestBenchOutputCache(
    DomainModel.Load(DomainModel.FixturePath()));
// The template family renders a Razor component, which is what ASP.NET Core ships for
// server-side HTML. Nothing else here needs it.
builder.Services.AddRazorComponents();
builder.Services.AddFastEndpoints();
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
app.UseExceptionHandler(Failures.Handler);
// Output caching sits in the pipeline rather than on an endpoint, so it is added once
// here and opted into per endpoint by CacheOutput.
app.UseOutputCache();
// The conditional middleware, branched onto the etag routes and nowhere else. UseWhen is
// ASP.NET Core's own way to scope a pipeline stage, and it is what this target uses rather
// than an endpoint filter: FastEndpoints writes the response from inside its own delegate,
// so a filter around it is handed nothing to hash.
app.UseWhen(context => context.Request.Path.StartsWithSegments("/etag"),
            branch => branch.Use(Caching.ConditionalGet));
app.UseFastEndpoints(config =>
{
    config.Serializer.Options.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
    config.Endpoints.RoutePrefix = null;
    // The envelope stays FastEndpoints' own; only the status moves. Its default for a
    // validation failure is 400, and body.rejected_* is a body that parsed and failed
    // semantically, which is 422.
    config.Errors.StatusCode = 422;
});
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Json(DomainModel.NotFoundBody(), statusCode: 404));

Console.Error.WriteLine($"container/fastendpoints listening on {HostInfo.Port()}");
app.Run();
