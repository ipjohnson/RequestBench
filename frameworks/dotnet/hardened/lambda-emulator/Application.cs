using Hardened.Aws.Lambda.Http;
using Hardened.Requests.Runtime;
using Hardened.Shared.Runtime.Attributes;
using Implementation;

namespace LambdaEmulator;

/// <summary>
/// The application module: Hardened's adapter for API Gateway payload format 2.0, over the
/// library's routes. A native build has no reflection, so [AotSerializerModule] registers JSON
/// serializers that read only the registered JsonContext.
/// </summary>
[HardenedModule]
[LambdaHttpModule]
[AotSerializerModule]
[ImplementationLibrary]
public partial class Application;
