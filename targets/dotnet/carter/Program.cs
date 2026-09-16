using Carter;
using RequestBench.CarterTarget;
using RequestBench.Domain;
using RequestBench.Hosts;

// RequestBench target: Carter. Framework wiring only; behaviour from RequestBench.Domain.
//
// One module per endpoint family, under Routes/. Carter finds them by scanning the
// assembly, so nothing here lists them.
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
builder.Services.AddCarter();
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
app.MapCarter();
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/carter listening on {HostInfo.Port()}");
app.Run();
