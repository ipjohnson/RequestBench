using RequestBench.AspNetMvc;
using RequestBench.Domain;
using RequestBench.Hosts;

// RequestBench target: ASP.NET Core MVC controllers. Framework wiring only; behaviour from
// RequestBench.Domain.
//
// One controller per endpoint family, under Controllers/. MVC finds them by convention, so
// nothing here lists them.
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestBenchDomain();
builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = Json.Options.PropertyNamingPolicy;
    });
// Nothing here overrides InvalidModelStateResponseFactory. A body MVC could not bind gets
// MVC's own 400 ProblemDetails, which is the contract a client of an ASP.NET API expects
// and which errors.malformed accepts alongside 422.
builder.WebHost.UseUrls(HostInfo.Url());
builder.Logging.ClearProviders();

WebApplication app = builder.Build();
app.UseExceptionHandler(Failures.Handler);
app.MapControllers();
// rb:snippet errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/aspnet-mvc listening on {HostInfo.Port()}");
app.Run();
