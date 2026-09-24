using System.Runtime.InteropServices;
using ContainerH2;
using Hardened.Shared.Runtime.Application;
using Hardened.Web.Kestrel.Runtime;
using Implementation;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;

ServiceCollection services = new();

// Logging with no provider, so no request writes a line.
services.AddLogging();
services.AddHardenedEnvironment(args);

new Application().PopulateServiceCollection(services);

// Every interface, on the port PORT names. Kestrel answers HTTP/2 with prior knowledge only on an
// endpoint that speaks nothing else.
await using HardenedKestrelApplication app = HardenedKestrelApplication.Create(services, kestrel =>
    kestrel.ListenAnyIP(KestrelListen.Port(Environment.GetEnvironmentVariable(KestrelListen.PortVariable)),
        listen => listen.Protocols = HttpProtocols.Http2));

await app.StartAsync();
Boot.Listening();

// A container is stopped with SIGTERM, and RunAsync with no signals leaves requests in flight
// unanswered.
await app.RunAsync([PosixSignal.SIGTERM, PosixSignal.SIGINT], TimeSpan.FromSeconds(10));
