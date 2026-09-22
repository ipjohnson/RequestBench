using Carter;
using Implementation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.FileProviders;

// RequestBench target: Carter. One module per corpus family under Routes/, which AddCarter
// finds by scanning the assembly.

// rb:wiring authorized.*
// With one authentication scheme registered, ASP.NET Core makes it the default and runs it
// on every request. The scheme belongs to /authorized, so the token policy names it and no
// other route pays for it.
AppContext.SetSwitch("Microsoft.AspNetCore.Authentication.SuppressAutoDefaultScheme", true);

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

Payloads payloads = Payloads.Load(Environment.GetEnvironmentVariable("RB_PAYLOADS")
    ?? throw new InvalidOperationException("RB_PAYLOADS has to name the payload directory"));
Settings settings = payloads.Settings;
int port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out int parsed) ? parsed : 8080;

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Logging.ClearProviders();

builder.Services.AddSingleton(payloads);
builder.Services.AddCarter();
// rb:wiring json.*
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default));
// An error status written with no body gets ASP.NET Core's ProblemDetails. Carter adds no
// error format of its own.
builder.Services.AddProblemDetails();
// rb:wiring cache.*
// settings.json's capacity counts entries, and this store is sized in bytes. Its default of
// 100 MB holds every key the cache family stores many times over.
builder.Services.AddOutputCache(options => options.DefaultExpirationTimeSpan = TimeSpan.FromSeconds(settings.Cache.TtlSeconds));
// rb:wiring compressed.*
builder.Services.AddResponseCompression();
// rb:wiring cors.*
// A policy listing exactly one origin sends no Vary: Origin, although its answer differs by
// origin. A policy that decides by predicate always sends it.
builder.Services.AddCors(options => options.AddPolicy(Policies.Cors, policy => policy
    .SetIsOriginAllowed(origin => origin == settings.Cors.Origin)
    .WithMethods(settings.Cors.Method)
    .WithHeaders(settings.Cors.Header)
    .SetPreflightMaxAge(TimeSpan.FromSeconds(settings.Cors.MaxAgeSeconds))));
// rb:wiring authorized.*
builder.Services.AddAuthentication().AddScheme<AuthenticationSchemeOptions, BearerToken>(BearerToken.SchemeName, _ => { });
builder.Services.AddAuthorization(options => options.AddPolicy(Policies.Token, policy => policy
    .AddAuthenticationSchemes(BearerToken.SchemeName)
    .RequireClaim(BearerToken.TokenClaim, settings.Token)));
// rb:end
// rb:wiring template.*
builder.Services.AddRazorComponents();

WebApplication app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
// rb:wiring compressed.*
// Ahead of the output cache, so a stored answer is kept as written and compressed for each
// request that asks.
app.UseResponseCompression();
// static.file: ASP.NET Core's static-file feature, serving the payload directory.
// rb:handler static.file
// rb:wiring static.*
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(payloads.Directory),
    RequestPath = "/static",
});
// rb:wiring cors.*
app.UseCors();
// rb:wiring authorized.*
app.UseAuthorization();
// rb:wiring cache.*
app.UseOutputCache();
app.MapCarter();

app.Lifetime.ApplicationStarted.Register(Boot.Listening);
app.Run();

// WebApplicationFactory<Program> in UnitTests has to name the class top-level statements
// compile to, which is internal unless declared public.
public partial class Program;
