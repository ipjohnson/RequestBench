using System.Reflection;
using System.Runtime.InteropServices;

namespace RequestBench.Hosts;

/// <summary>
/// What every .NET target needs from the host: the port to bind and what to answer on
/// /__meta. Named HostInfo rather than Host because Microsoft.Extensions.Hosting.Host is in
/// every web target's implicit usings.
///
/// Only the container contract is implemented. That is Cloud Run's contract and therefore
/// covers Fargate, ECS and plain Docker unchanged; the function hosts are not wired yet.
/// </summary>
public static class HostInfo
{
    public static int Port() =>
        int.TryParse(Environment.GetEnvironmentVariable("PORT"), out int p) ? p : 8080;

    public static string Url() => $"http://0.0.0.0:{Port()}";

    /// <summary>
    /// The version the restore resolved for an assembly, read from the assembly actually
    /// loaded rather than from a constant kept current by hand.
    /// </summary>
    public static string Version(Assembly assembly)
    {
        string? informational = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        // The informational version carries a source-revision suffix on the shared
        // framework assemblies, which is build metadata rather than the version anyone
        // pins.
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus]
             : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }

    public static string Version(Type typeFromAssembly) => Version(typeFromAssembly.Assembly);

    /// <summary>
    /// <summary>
    /// The Razor version the five targets that render with it report. Resolved by assembly
    /// name rather than by referencing a component type, because this project is a plain
    /// library and referencing one would make it a web project.
    /// </summary>
    public static string Razor =>
        "razor " + (AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "Microsoft.AspNetCore.Components")
            ?.GetName().Version?.ToString(3) ?? "");

    /// What a target answers on /__meta. Outside the blend spec on purpose: it is not
    /// measured and not checked against spec/expected.json, it exists so a point on the
    /// results chart can be attributed to a framework version rather than to a different
    /// runner.
    ///
    /// adapter is empty under the container contract, where the framework serves its own
    /// requests. template is the engine this target renders the template family with. Each
    /// target passes its own, because each reaches an engine through its own framework's
    /// view facility.
    /// </summary>
    public static IReadOnlyDictionary<string, string> Meta(
        string framework, string version, string template,
        string serializer = "System.Text.Json") =>
        new Dictionary<string, string>
        {
            ["framework"] = framework,
            ["version"] = version,
            ["runtime"] = RuntimeInformation.FrameworkDescription,
            ["adapter"] = "",
            ["serializer"] = serializer,
            ["template"] = template,
        };
}
