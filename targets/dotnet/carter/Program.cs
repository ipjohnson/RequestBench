using Carter;
using FluentValidation;
using RequestBench.CarterTarget;
using RequestBench.CarterTarget.Routes;
using RequestBench.Domain;
using RequestBench.Hosts;

// RequestBench target: Carter. Framework wiring only; behaviour from RequestBench.Domain.
//
// One module per endpoint family, under Routes/. Carter finds them by scanning the
// assembly, so nothing here lists them.
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
// ASP.NET Core's own response cache, sized from the fixture. A policy per shape a
// cache.* row is keyed by, which is where the vary rows say what folds into the key.
builder.Services.AddRequestBenchOutputCache(
    DomainModel.Load(DomainModel.FixturePath()));
// The template family renders a Razor component, which is what ASP.NET Core ships for
// server-side HTML. Nothing else here needs it.
builder.Services.AddRazorComponents();
builder.Services.AddCarter();
// Carter 10 ships no validation, so the validator is registered here and injected into the
// routes that need it. One validator, declared once in OrderBodyValidator.
builder.Services.AddSingleton<IValidator<OrderBody>, OrderBodyValidator>();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
});
// A body the framework cannot bind short-circuits with its own 400 and never raises, so the
// handler that turns failures into responses never sees it. Carter routes onto minimal
// APIs, so this is the same setting minimal-apis needs.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
app.UseExceptionHandler(Failures.Handler);
// Output caching sits in the pipeline rather than on a route, so it is added once
// here and opted into per route by CacheOutput.
app.UseOutputCache();
app.MapCarter();
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/carter listening on {HostInfo.Port()}");
app.Run();
