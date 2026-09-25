using Hardened.Aws.Lambda.Runtime.Hosting;
using Hardened.Shared.Runtime.Application;
using LambdaEmulator;
using Microsoft.Extensions.DependencyInjection;

ServiceCollection services = new();

// No logging provider, as the other .NET targets clear theirs. Hardened logs every refusal, such
// as each 404 the errors rows ask for, and a provider would write a line for each.
services.AddLogging();
services.AddHardenedEnvironment(new EnvironmentImpl(arguments: args));

new Application().PopulateServiceCollection(services);

// Runs the startup services, then takes each event from the Runtime API that
// AWS_LAMBDA_RUNTIME_API names. There is no server and no port.
await HardenedLambdaBootstrap.Run(services.BuildServiceProvider());
