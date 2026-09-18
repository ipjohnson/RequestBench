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
// rb:wiring compressed.*
builder.Services.AddResponseCompression();
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
// rb:wiring errors.*
app.UseExceptionHandler(Failures.Handler);
// Response compression covers the whole application, so every request pays the check for
// accept-encoding. Branching it onto /compressed with UseWhen would not save that, because
// the branch's predicate runs on every request too. It sits ahead of the output cache, so a
// cached answer is stored as written and compressed for each request that asks.
// rb:wiring compressed.*
app.UseResponseCompression();
// Output caching sits in the pipeline rather than on a route, so it is added once
// here and opted into per route by CacheOutput.
app.UseOutputCache();
app.MapCarter();
// rb:handler errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

app.Lifetime.ApplicationStarted.Register(HostInfo.Listening);
Console.Error.WriteLine($"container/carter listening on {HostInfo.Port()}");
app.Run();

// Top-level statements compile to an internal Program, which WebApplicationFactory<Program> in suite/
// cannot name. Declaring it public is what the ASP.NET Core integration-testing
// documentation asks a target to do, and it is the whole of what testing costs this target.
public partial class Program;
