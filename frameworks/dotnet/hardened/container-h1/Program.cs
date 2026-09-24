using System.Runtime.InteropServices;
using ContainerH1;
using Hardened.Shared.Runtime.Application;
using Hardened.Web.Kestrel.Runtime;
using Implementation;
using Microsoft.Extensions.DependencyInjection;

ServiceCollection services = new();

// Logging with no provider, so no request writes a line.
services.AddLogging();
services.AddHardenedEnvironment(args);

new Application().PopulateServiceCollection(services);

// Every interface, on the port PORT names.
await using HardenedKestrelApplication app = HardenedKestrelApplication.Create(services, kestrel => KestrelListen.FromEnvironment(kestrel));

await app.StartAsync();
Boot.Listening();

// A container is stopped with SIGTERM, and RunAsync with no signals leaves requests in flight
// unanswered.
await app.RunAsync([PosixSignal.SIGTERM, PosixSignal.SIGINT], TimeSpan.FromSeconds(10));
