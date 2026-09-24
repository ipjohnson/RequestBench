using System.IO.Compression;
using Implementation;
using Implementation.Endpoints;
using JasperFx;
using JasperFx.CodeGeneration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.FileProviders;
using Wolverine;
using Wolverine.FluentValidation;
using Wolverine.Http;
using Wolverine.Http.FluentValidation;

// RequestBench target: Wolverine.HTTP. One endpoint class per corpus family under Endpoints/,
// which Wolverine finds by the Endpoints suffix, and the handler Wolverine generated for each
// endpoint under Internal/Generated.

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

builder.Host.UseWolverine(opts =>
{
    // The handlers are the ones `dotnet run -- codegen write` wrote under Internal/Generated,
    // compiled with the rest of the project. Wolverine's docs recommend this for production. A
    // handler compiled at runtime is built at Roslyn's debug level, and a route with no generated
    // handler fails at startup rather than compiling one.
    opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
    // Wolverine serves HTTP here and carries no messages. The default durability mode assumes
    // load-balanced nodes with messaging active. MediatorOnly turns off node persistence and the
    // inbox and outbox.
    opts.Durability.Mode = DurabilityMode.MediatorOnly;
    // rb:wiring body.*
    // Registers every FluentValidation validator in the project, which the HTTP middleware below
    // finds by the endpoint's request type.
    opts.UseFluentValidation();
});
builder.Services.AddWolverineHttp();

builder.Services.AddSingleton(payloads);
// The document dotnet build writes to Client/openapi.json. Nothing maps a route to it.
builder.Services.AddOpenApi();
// rb:wiring json.*
builder.Services.ConfigureSystemTextJsonForWolverineOrMinimalApi(options => options.SerializerOptions.TypeInfoResolverChain.Insert(0, JsonContext.Default));
// rb:wiring cache.*
// settings.json's capacity counts entries, and this store is sized in bytes. Its default of
// 100 MB holds every key the cache family stores many times over.
builder.Services.AddOutputCache(options =>
{
    TimeSpan ttl = TimeSpan.FromSeconds(settings.Cache.TtlSeconds);
    options.AddPolicy(Policies.Stored, policy => policy.Expire(ttl));
    options.AddPolicy(Policies.VaryOne, policy => policy.Expire(ttl).SetVaryByHeader([.. settings.Cache.Vary.One.Keys]));
    options.AddPolicy(Policies.VaryMany, policy => policy.Expire(ttl).SetVaryByHeader([.. settings.Cache.Vary.Many.Keys]));
});
// rb:wiring compressed.*
// Fastest is already the provider's default, and every framework here compresses at that level,
// so the route says so rather than leaving it to a default.
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
// rb:wiring template.*
builder.Services.AddRazorComponents();

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
app.MapWolverineEndpoints(opts =>
{
    // rb:wiring body.*
    // Wolverine's FluentValidation middleware, generated into the handler of every endpoint whose
    // request type has a validator. It answers the failures as a ValidationProblemDetails.
    opts.UseFluentValidationProblemDetailMiddleware();
    // rb:wiring etag.*
    opts.AddResourceWriterPolicy<ETagWriterPolicy>();
});

// JasperFx's command line, which runs `dotnet run -- codegen write`. Wolverine's docs end
// Program.cs with it. Starting the server through it added about 40 ms to the boot, because it
// finds its commands first, so the server starts through app.Run().
if (args is ["codegen", ..])
{
    return await app.RunJasperFxCommands(args);
}

app.Lifetime.ApplicationStarted.Register(Boot.Listening);
app.Run();
return 0;

// Alba's AlbaHost.For<Program> in UnitTests has to name the class top-level statements compile
// to, which is internal unless declared public.
public partial class Program;
