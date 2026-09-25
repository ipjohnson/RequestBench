using Hardened.Shared.Runtime.Attributes;
using Hardened.Web.Kestrel.Runtime;
using Implementation;

namespace ContainerH1;

/// <summary>The application module: Hardened's Kestrel host, over the library's routes.</summary>
[HardenedModule]
[KestrelRuntime]
[ImplementationLibrary]
public partial class Application;
