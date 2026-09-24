using System.IO.Compression;
using Implementation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;

// RequestBench target: ASP.NET Core MVC. One controller per corpus family under Controllers/,
// which MapControllers finds by scanning the assembly.

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
// On lambda-emulator, where AWS_LAMBDA_FUNCTION_NAME is set, Amazon.Lambda.AspNetCoreServer
// serves the application in Kestrel's place, and the Lambda runtime client hands it each API
// Gateway payload format 2.0 event. On the other hosts this does nothing.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddSingleton(payloads);
// rb:wiring template.*
// Controllers, and the Razor view engine that renders the template family's view.
IMvcBuilder mvc = builder.Services.AddControllersWithViews();
// rb:wiring json.*
mvc.AddJsonOptions(options => options.JsonSerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default));
// An IResult an action returns, such as the server-sent events result, writes with the
// minimal API JSON options rather than MVC's.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default));
// rb:end
// The document dotnet build writes to Client/openapi.json. Nothing maps a route to it.
builder.Services.AddOpenApi();
// An error status written with no body, such as routing's 404 and 405, gets ASP.NET Core's
// ProblemDetails. An [ApiController] refusal is MVC's own ProblemDetails already.
builder.Services.AddProblemDetails();
// rb:wiring cache.*
// settings.json's capacity counts entries, and this store is sized in bytes. Its default of
// 100 MB holds every key the cache family stores many times over.
builder.Services.AddOutputCache(options =>
{
    options.DefaultExpirationTimeSpan = TimeSpan.FromSeconds(settings.Cache.TtlSeconds);
    options.AddPolicy(Policies.VaryOne, policy => policy.SetVaryByHeader([.. settings.Cache.Vary.One.Keys]));
    options.AddPolicy(Policies.VaryMany, policy => policy.SetVaryByHeader([.. settings.Cache.Vary.Many.Keys]));
});
// rb:wiring compressed.*
// Fastest is already the provider's default, and every framework here compresses at that level,
// so the setting says so rather than leaving it to a default.
builder.Services.AddResponseCompression();
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
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
app.MapControllers();

app.Lifetime.ApplicationStarted.Register(Boot.Listening);
app.Run();

// WebApplicationFactory<Program> in UnitTests has to name the class top-level statements
// compile to, which is internal unless declared public.
public partial class Program;
