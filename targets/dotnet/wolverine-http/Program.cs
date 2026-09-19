using RequestBench.Domain;
using RequestBench.WolverineTarget;
using RequestBench.WolverineTarget.Routes;
using RequestBench.Hosts;
using JasperFx;
using JasperFx.CodeGeneration;
using Wolverine.FluentValidation;
using Wolverine;
using Wolverine.Http;
using Wolverine.Http.FluentValidation;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

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
// Wolverine serializes with these options, minimal APIs' own.
// rb:wiring json.*
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default);
});
// The middleware finds the validator through the container, so it has to be registered.
// Without this it finds none, validates nothing, and a missing field reaches the endpoint.
// Wolverine's own registration registers OrderBodyValidator as a singleton, because it
// takes no constructor arguments, and the generated endpoint takes a singleton once in its
// constructor. A scoped validator would be built again on every request.
builder.Host.UseWolverine(opts =>
{
    opts.UseFluentValidation();
    // The endpoint adapters come from Internal/Generated, compiled with the rest of the
    // target. Compiled at runtime instead, they are built at Roslyn's debug optimization
    // level, and the JIT never optimizes them. A route with no generated adapter throws
    // ExpectedTypeMissingException instead of compiling one. `dotnet run -- codegen write`
    // in this directory rewrites them after an endpoint changes.
    opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
    // Wolverine serves HTTP here and carries no messages. The default, Balanced, assumes
    // load-balanced nodes with messaging active and starts the agents for them.
    opts.Durability.Mode = DurabilityMode.MediatorOnly;
});
builder.Services.AddWolverineHttp();
// The created row sets a Location header, and a Wolverine handler is a static
// method with no HttpContext of its own unless one is injected.
builder.Services.AddHttpContextAccessor();
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
// rb:wiring errors.*
app.UseExceptionHandler(Failures.Handler);
// Response compression covers the whole application, so every request pays the check for
// accept-encoding. Branching it onto /compressed with UseWhen, as the etag routes are below,
// would not save that, because the branch's predicate runs on every request too. It sits
// ahead of the output cache, so a cached answer is stored as written and compressed for
// each request that asks.
// rb:wiring compressed.*
app.UseResponseCompression();
// Output caching sits in the pipeline rather than on an endpoint, so it is added once here
// and opted into per route below.
app.UseOutputCache();
// The conditional middleware, branched onto the etag routes and nowhere else. UseWhen is
// ASP.NET Core's own way to scope a pipeline stage, and it is what this target uses rather
// than an endpoint filter: Wolverine writes the response from inside its compiled endpoint,
// so a filter around it is handed nothing to hash.
app.UseWhen(context => context.Request.Path.StartsWithSegments("/etag"),
            branch => branch.Use(Caching.ConditionalGet));
app.MapWolverineEndpoints(opts =>
{
    // Wolverine's own validation facility: middleware that runs a FluentValidation
    // validator on the request before the endpoint method, compiled into the handler
    // rather than reflected over per request.
    opts.UseFluentValidationProblemDetailMiddleware();
});
// rb:handler errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

// JasperFx's command line, for `dotnet run -- codegen write`. It runs only for that verb,
// because it loads every assembly in the output directory to look for commands, and a
// start through app.Run() loads none of them.
if (args is ["codegen", ..])
{
    return await app.RunJasperFxCommands(args);
}

app.Lifetime.ApplicationStarted.Register(HostInfo.Listening);
Console.Error.WriteLine($"container/wolverine-http listening on {HostInfo.Port()}");
app.Run();
return 0;

// Top-level statements compile to an internal Program, which Alba's AlbaHost.For<Program> in suite/
// cannot name. Declaring it public is what the ASP.NET Core integration-testing
// documentation asks a target to do, and it is the whole of what testing costs this target.
public partial class Program;
