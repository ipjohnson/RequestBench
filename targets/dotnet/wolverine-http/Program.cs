using RequestBench.Domain;
using RequestBench.WolverineTarget;
using RequestBench.Hosts;
using Wolverine;
using Wolverine.Http;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
});
builder.Host.UseWolverine();
builder.Services.AddWolverineHttp();
// The created row sets a Location header, and a Wolverine handler is a static
// method with no HttpContext of its own unless one is injected.
builder.Services.AddHttpContextAccessor();
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
app.UseExceptionHandler(Failures.Handler);
app.MapWolverineEndpoints();
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/wolverine-http listening on {HostInfo.Port()}");
app.Run();
