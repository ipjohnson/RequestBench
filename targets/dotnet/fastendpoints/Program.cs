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
builder.Services.AddFastEndpoints();
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
app.UseExceptionHandler(Failures.Handler);
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
