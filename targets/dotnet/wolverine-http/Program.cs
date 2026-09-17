using RequestBench.Domain;
using RequestBench.WolverineTarget;
using RequestBench.WolverineTarget.Routes;
using RequestBench.Hosts;
using FluentValidation;
using Wolverine;
using Wolverine.Http;
using Wolverine.Http.FluentValidation;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
// ASP.NET Core's own response cache, sized from the fixture. A policy per shape a
// cache.* row is keyed by, which is where the vary rows say what folds into the key.
builder.Services.AddRequestBenchOutputCache(
    DomainModel.Load(DomainModel.FixturePath()));
// The template family renders a Razor component, which is what ASP.NET Core ships for
// server-side HTML. Nothing else here needs it.
builder.Services.AddRazorComponents();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
});
builder.Host.UseWolverine();
builder.Services.AddWolverineHttp();
// The middleware finds the validator through the container, so it has to be registered.
// Without this it finds none, validates nothing, and a missing field reaches the endpoint.
builder.Services.AddScoped<IValidator<OrderBody>, OrderBodyValidator>();
// The created row sets a Location header, and a Wolverine handler is a static
// method with no HttpContext of its own unless one is injected.
builder.Services.AddHttpContextAccessor();
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
// rb:wiring errors.*
app.UseExceptionHandler(Failures.Handler);
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

Console.Error.WriteLine($"container/wolverine-http listening on {HostInfo.Port()}");
app.Run();
