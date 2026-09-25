using ContainerH1;
using Hardened.Shared.Runtime.Application;
using Hardened.Web.Kestrel.Runtime;
using Implementation;
using Microsoft.Extensions.DependencyInjection;

int port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out int configured) ? configured : 8080;

ServiceCollection services = new();

// No logging provider, as the other .NET targets clear theirs. Hardened logs every refusal, such
// as each 404 the errors rows ask for, and a provider would write a line for each.
services.AddLogging();
services.AddHardenedEnvironment(new EnvironmentImpl(arguments: args));

new Application().PopulateServiceCollection(services);

await using HardenedKestrelApplication app = HardenedKestrelApplication.Create(services, kestrel => kestrel.ListenAnyIP(port));

await app.StartAsync();
Boot.Listening();

// Stops on SIGTERM, and lets the requests in flight finish.
await app.RunAsync();
