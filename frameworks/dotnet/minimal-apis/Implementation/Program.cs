using System.IO.Compression;
using Amazon.Lambda.Serialization.SystemTextJson;
using Implementation;
using Implementation.Routes;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;

// RequestBench target: ASP.NET Core minimal APIs. One static class per corpus family under
// Routes/, each mapping its own routes onto the application.

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
// Gateway payload format 2.0 event. The function there is a Native AOT build, so the events are
// read and written with source-generated metadata. On the other hosts this does nothing.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi, new SourceGeneratorLambdaJsonSerializer<LambdaJsonContext>());

builder.Services.AddSingleton(payloads);
// The document dotnet build writes to Client/openapi.json. Nothing maps a route to it.
builder.Services.AddOpenApi();
// rb:wiring json.*
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default));
// An error status written with no body gets ASP.NET Core's ProblemDetails.
builder.Services.AddProblemDetails();
// rb:wiring body.*
// Minimal APIs' own validation, new in .NET 10. A source generator describes the types handlers
// bind, and an endpoint filter checks their DataAnnotations before the handler runs.
// The filter goes on every route that binds a class, HttpRequest and HttpResponse included,
// and checks it on every request. The routes that bind one and validate nothing opt out with
// DisableValidation, so only the validate routes pay for validation, as in Carter.
builder.Services.AddValidation();
// rb:wiring cache.*
// settings.json's capacity counts entries, and this store is sized in bytes. Its default of
// 100 MB holds every key the cache family stores many times over.
builder.Services.AddOutputCache(options => options.DefaultExpirationTimeSpan = TimeSpan.FromSeconds(settings.Cache.TtlSeconds));
// rb:wiring compressed.*
// A Function URL's requests are HTTPS, and ASP.NET Core compresses an answer to HTTPS only with
// EnableForHttps. The container hosts are plain HTTP, where it changes nothing.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
// Fastest is already the provider's default, and every framework here compresses at that level,
// so the route says so rather than leaving it to a default.
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
// rb:wiring template.*
// ASP.NET Core marks Razor components as unsupported under Native AOT. The one component here
// renders statically, and lambda-emulator's native build answers both template tests.
#pragma warning disable IL2026
builder.Services.AddRazorComponents();
#pragma warning restore IL2026

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

AuthorizedRoutes.Map(app);
BaselineRoutes.Map(app);
BodyRoutes.Map(app);
CacheRoutes.Map(app);
CompressedRoutes.Map(app);
ContractRoutes.Map(app);
CorsRoutes.Map(app);
EtagRoutes.Map(app);
FormsRoutes.Map(app);
HeadersRoutes.Map(app);
ItemsRoutes.Map(app);
JsonRoutes.Map(app);
MiddlewareRoutes.Map(app);
ParametersRoutes.Map(app);
QueryRoutes.Map(app);
SseRoutes.Map(app);
StreamRoutes.Map(app);
TemplateRoutes.Map(app);

app.Lifetime.ApplicationStarted.Register(Boot.Listening);
app.Run();

// WebApplicationFactory<Program> in UnitTests has to name the class top-level statements
// compile to, which is internal unless declared public.
public partial class Program;
