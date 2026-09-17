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
app.UseExceptionHandler(Failures.Handler);
app.MapWolverineEndpoints(opts =>
{
    // Wolverine's own validation facility: middleware that runs a FluentValidation
    // validator on the request before the endpoint method, compiled into the handler
    // rather than reflected over per request.
    opts.UseFluentValidationProblemDetailMiddleware();
});
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/wolverine-http listening on {HostInfo.Port()}");
app.Run();
