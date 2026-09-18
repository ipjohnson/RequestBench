using System.Diagnostics;
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

    // Milliseconds from the start of the process to the server listening, once it is.
    private static double? bootMs;

    /// <summary>
    /// Records that the server is listening, for /__meta to report as boot_ms. A target
    /// registers this on ApplicationStarted, which ASP.NET Core raises once Kestrel has
    /// bound. The start is the process's own, so the runtime's start is counted along with
    /// the framework's. On Linux the kernel keeps it in 10 ms ticks, which is the resolution
    /// of the result.
    /// </summary>
    public static void Listening()
    {
        using Process self = Process.GetCurrentProcess();
        bootMs = Math.Round((DateTime.Now - self.StartTime).TotalMilliseconds, 1);
    }

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
    /// The Razor version the five targets that render with it report. Resolved by assembly
    /// name rather than by referencing a component type, because this project is a plain
    /// library and referencing one would make it a web project.
    /// </summary>
    public static string Razor =>
        "razor " + (AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "Microsoft.AspNetCore.Components")
            ?.GetName().Version?.ToString(3) ?? "");

    /// <summary>
    /// What a target answers on /__meta. Outside the blend spec on purpose: it is not
    /// measured and not checked against spec/expected.json, it exists so a point on the
    /// results chart can be attributed to a framework version rather than to a different
    /// runner.
    ///
    /// adapter is empty under the container contract, where the framework serves its own
    /// requests. template is the engine this target renders the template family with. Each
    /// target passes its own, because each reaches an engine through its own framework's
    /// view facility.
    ///
    /// etag and cache are not passed, because here the five targets really do share them.
    /// ASP.NET Core computes no validator for a dynamic response, so the digest is the one
    /// in Caching.Revalidates and five copies would only drift; the response cache is the
    /// framework's own output caching, which every target wires the same way and differs
    /// only in where it attaches.
    /// </summary>
    public static IReadOnlyDictionary<string, object> Meta(
        string framework, string version, string template,
        string serializer = "System.Text.Json")
    {
        Dictionary<string, object> meta = new()
        {
            ["framework"] = framework,
            ["version"] = version,
            ["runtime"] = RuntimeInformation.FrameworkDescription,
            ["adapter"] = "",
            ["serializer"] = serializer,
            ["template"] = template,
            ["etag"] = "sha1 (asp.net core ships no conditional handling)",
            ["cache"] = "asp.net core output caching",
        };
        if (bootMs is double ms)
        {
            meta["boot_ms"] = ms;
        }
        return meta;
    }
}
