using ContainerH2;
using Hardened.Shared.Runtime.Application;
using Hardened.Web.Kestrel.Runtime;
using Implementation;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;

int port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out int configured) ? configured : 8080;

ServiceCollection services = new();

// No logging provider, as the other .NET targets clear theirs. Hardened logs every refusal, such
// as each 404 the errors rows ask for, and a provider would write a line for each.
services.AddLogging();
services.AddHardenedEnvironment(new EnvironmentImpl(arguments: args));

new Application().PopulateServiceCollection(services);

// Kestrel answers HTTP/2 with prior knowledge only on an endpoint that speaks nothing else.
await using HardenedKestrelApplication app = HardenedKestrelApplication.Create(
    services,
    kestrel => kestrel.ListenAnyIP(port, listen => listen.Protocols = HttpProtocols.Http2));

await app.StartAsync();
Boot.Listening();

// Stops on SIGTERM, and lets the requests in flight finish.
await app.RunAsync();
