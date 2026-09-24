using System.Reflection;
using Hardened.Kiota.Testing;
using Hardened.Web.Kestrel.Testing;
using Implementation;
using UnitTests;

// Each test builds ImplementationLibrary, as the application's hosts import it, and sends its
// requests through the pipeline in process. A class marked [KestrelRuntime] sends them to Kestrel
// on a loopback port instead. A Kiota client parameter sends through the same pipeline.
[assembly: WebTesting]
[assembly: HardenedTestEntryPoint(typeof(ImplementationLibrary))]
[assembly: KestrelTesting]
[assembly: KiotaTesting]
[assembly: CommittedPayloads]

namespace UnitTests;

/// <summary>
/// Gives each test's environment RB_PAYLOADS, which the library module reads. A test's environment
/// reads only the values a test declares, and this one is a path found at run time.
/// </summary>
[AttributeUsage(AttributeTargets.Assembly)]
public sealed class CommittedPayloadsAttribute : Attribute, IHardenedTestEnvironmentAttribute
{
    public void ConfigureEnvironment(AttributeCollection attributeCollection, MethodInfo methodInfo, string environmentName, IDictionary<string, object> environment) =>
        environment["RB_PAYLOADS"] = Expected.Directory;
}
