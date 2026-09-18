using RequestBench.Domain;
using RequestBench.Hosts;
using RequestBench.MinimalApis.Routes;

// RequestBench target: ASP.NET Core minimal APIs. Framework wiring only; behaviour from
// RequestBench.Domain.
//
// One file per endpoint family, under Routes/. Each maps its own routes and nothing else is
// shared between them. Forty-five handlers in one file is a file nobody reads, and a family
// is the unit a rewiring or a rerun is scoped to.
WebApplicationBuilder builder = WebApplication.CreateSlimBuilder(args);

// The domain arrives through the service collection, so a handler that did not ask for it
// has nothing to call. The fixture is read here, before the host is built, so a target that
// cannot read it fails at startup rather than on the first request.
builder.Services.AddRequestBenchDomain();
// ASP.NET Core's own response cache, sized from the fixture. A policy per shape a
// cache.* row is keyed by, which is where the vary rows say what folds into the key.
builder.Services.AddRequestBenchOutputCache(
    DomainModel.Load(DomainModel.FixturePath()));
// rb:wiring compressed.*
builder.Services.AddResponseCompression();
// The template family renders a Razor component, which is what ASP.NET Core ships for
// server-side HTML. Nothing else here needs it.
builder.Services.AddRazorComponents();
// Minimal APIs' own validation, new in .NET 10: this makes the framework check the
// DataAnnotations on a parameter's type before the handler runs and answer a
// ValidationProblem itself when they fail. Without it the attributes are inert and no
// handler would be calling a validator either.
builder.Services.AddValidation();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
});
// A body the framework cannot bind short-circuits with its own 400 and never raises, so the
// handler that turns failures into the shared shapes never sees it. Outside Development
// this is off by default, which is how errors.malformed answered 400 where the endpoint set
// says 422.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
DomainModel model = app.Services.GetRequiredService<DomainModel>();
// Response compression covers the whole application, so every request pays the check for
// accept-encoding. Branching it onto /compressed with UseWhen would not save that, because
// the branch's predicate runs on every request too. It sits ahead of the output cache, so a
// cached answer is stored as written and compressed for each request that asks.
// rb:wiring compressed.*
app.UseResponseCompression();
// Output caching sits in the pipeline rather than on an endpoint, so it is added once
// here and opted into per route by CacheOutput.
app.UseOutputCache();

Failures.Map(app);
Baseline.Map(app);
JsonRoutes.Map(app);
Parameters.Map(app);
Query.Map(app);
Headers.Map(app);
Middleware.Map(app);
Authorized.Map(app);
Compressed.Map(app);
Etag.Map(app);
Cache.Map(app, model);
Body.Map(app);
DomainRoutes.Map(app);
Templates.Map(app);

app.Lifetime.ApplicationStarted.Register(HostInfo.Listening);
Console.Error.WriteLine($"container/minimal-apis listening on {HostInfo.Port()}");
app.Run();

// Top-level statements compile to an internal Program, which WebApplicationFactory<Program>
// in suite/ cannot name. Declaring it public is what the ASP.NET Core integration-testing
// documentation asks a target to do, and it is the whole of what testing costs this target.
public partial class Program;
