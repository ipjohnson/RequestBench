using Hardened.Aws.Lambda.Http;
using Hardened.Requests.Runtime;
using Hardened.Shared.Runtime.Attributes;
using Implementation;

namespace LambdaEmulator;

/// <summary>
/// The application module: Hardened's API Gateway payload format 2.0 adapter, with the Lambda
/// invocation loop it brings, and the library that holds the routes. A native build has no
/// reflection, so the JSON serializers read only the registered resolvers.
/// </summary>
[HardenedModule]
[LambdaHttpModule]
[AotSerializerModule]
[ImplementationLibrary]
public partial class Application;
