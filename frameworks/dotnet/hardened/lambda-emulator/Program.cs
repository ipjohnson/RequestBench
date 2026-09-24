using Hardened.Aws.Lambda.Runtime.Hosting;
using Hardened.Shared.Runtime.Application;
using LambdaEmulator;
using Microsoft.Extensions.DependencyInjection;

ServiceCollection services = new();

// Logging with no provider, so no invocation writes a line.
services.AddLogging();
services.AddHardenedEnvironment(args);

new Application().PopulateServiceCollection(services);

// No server and no port: this runs the startup services, then takes invocations from the Lambda
// Runtime API that AWS_LAMBDA_RUNTIME_API names.
await HardenedLambdaBootstrap.Run(services.BuildServiceProvider());
