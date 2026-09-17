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
// ASP.NET Core's own response cache, sized from the fixture. A policy per shape a
// cache.* row is keyed by, which is where the vary rows say what folds into the key.
builder.Services.AddRequestBenchOutputCache(
    DomainModel.Load(DomainModel.FixturePath()));
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
// rb:wiring errors.*
app.UseExceptionHandler(Failures.Handler);
// Output caching sits in the pipeline rather than on an action, so it is added once
// here and opted into per action by the OutputCache attribute.
app.UseOutputCache();
app.MapControllers();
// rb:handler errors.unmatched
app.MapFallback(() => Results.Problem(statusCode: 404));

Console.Error.WriteLine($"container/aspnet-mvc listening on {HostInfo.Port()}");
app.Run();
