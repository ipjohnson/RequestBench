using System.IO.Compression;
using Amazon.Lambda.Serialization.SystemTextJson;
using FastEndpoints;
using FastEndpoints.OpenApi;
using FastEndpoints.OpenApi.Kiota;
using Implementation;
using Kiota.Builder;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi;

// RequestBench target: FastEndpoints. One endpoint class per route, the classes of a family
// together in one file under Endpoints/. FastEndpoints.Generator lists them at build, so
// nothing scans the assembly at startup.

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
builder.Services.AddFastEndpoints(DiscoveredTypes.All);
// The document the client export below writes. Nothing maps a route to it. The token
// /authorized reads is opaque, so the document declares a plain bearer scheme in place of
// FastEndpoints' default JWT one.
builder.Services.OpenApiDocument(options =>
{
    options.ShortSchemaNames = true;
    options.EnableJWTBearerAuth = false;
    options.AddAuth("Bearer", new() { Type = SecuritySchemeType.Http, Scheme = "bearer" });
});
// rb:wiring cache.*
// settings.json's capacity counts entries, and this store is sized in bytes. Its default of
// 100 MB holds every key the cache family stores many times over.
builder.Services.AddOutputCache(options => options.DefaultExpirationTimeSpan = TimeSpan.FromSeconds(settings.Cache.TtlSeconds));
// rb:wiring compressed.*
// A Function URL's requests are HTTPS, and ASP.NET Core compresses an answer to HTTPS only with
// EnableForHttps. The container hosts are plain HTTP, where it changes nothing.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
// Fastest is already the provider's default, and every framework here compresses at that level,
// so the application says so rather than leaving it to a default.
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
app.UseFastEndpoints(config =>
{
    // rb:wiring authorized.*
    // FastEndpoints secures every endpoint by default. Every endpoint that names no policy is
    // open to anyone.
    config.Endpoints.Configurator = endpoint =>
    {
        if (endpoint.PreBuiltUserPolicies is null)
        {
            endpoint.AllowAnonymous();
        }
    };
    // rb:wiring json.*
    config.Serializer.Options.TypeInfoResolverChain.Insert(0, JsonContext.Default);
    // The binders' object factories, property setters and value parsers, which
    // FastEndpoints.Generator writes at build instead of FastEndpoints compiling them at runtime.
    config.Binding.ReflectionCache.AddFromImplementation();
});

// Client/Kiota: run with --generateclients true, the application starts, writes the OpenAPI
// document and the Kiota client generated from it, and exits. The generation sits in a local
// function, so a normal start never loads Kiota.
if (app.IsApiClientGenerationMode())
{
    await GenerateClientAsync(app);
}

app.Lifetime.ApplicationStarted.Register(Boot.Listening);
app.Run();

static Task GenerateClientAsync(WebApplication app) => app.GenerateApiClientsAndExitAsync(client =>
{
    client.OpenApiDocumentName = "v1";
    client.Language = GenerationLanguage.CSharp;
    client.OutputPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "Client", "Kiota"));
    client.ClientNamespaceName = "Client.Kiota";
    client.ClientClassName = "FastEndpointsClient";
    client.ExcludeBackwardCompatible = true;
});

// FastEndpoints.Testing's AppFixture<Program> in UnitTests has to name the class top-level
// statements compile to, which is internal unless declared public.
public partial class Program;
