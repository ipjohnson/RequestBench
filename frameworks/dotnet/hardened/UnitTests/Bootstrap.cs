using System.Reflection;
using Hardened.Kiota.Testing;
using Hardened.Shared.Testing.Attributes;
using Hardened.Web.Kestrel.Testing;
using Implementation;
using UnitTests;

// Each test builds the library module, with ITestWebApp sending into its pipeline.
[assembly: WebTesting]
[assembly: HardenedTestEntryPoint(typeof(ImplementationLibrary))]

// A class marked [KestrelRuntime] runs on a real socket.
[assembly: KestrelTesting]

// HardenedClient, from Client/, as a test parameter.
[assembly: KiotaTesting]

[assembly: Payloads]

namespace UnitTests;

/// <summary>
/// RB_PAYLOADS in every test's environment. A test reads only the values it declares, not the
/// process's, and the directory is found at run time, so an attribute declares it.
/// </summary>
[AttributeUsage(AttributeTargets.Assembly)]
public sealed class PayloadsAttribute : Attribute, IHardenedTestEnvironmentAttribute
{
    /// <summary>tests/payloads, found by walking up from the test binary to the repository.</summary>
    public static string Directory { get; } = Find();

    public void ConfigureEnvironment(AttributeCollection attributeCollection, MethodInfo methodInfo, string environmentName, IDictionary<string, object> environment) =>
        environment["RB_PAYLOADS"] = Directory;

    private static string Find()
    {
        for (DirectoryInfo? dir = new(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            string candidate = Path.Combine(dir.FullName, "tests", "payloads");
            if (File.Exists(Path.Combine(candidate, "items.large.json")))
            {
                return candidate;
            }
        }
        throw new DirectoryNotFoundException($"no tests/payloads above {AppContext.BaseDirectory}");
    }
}
