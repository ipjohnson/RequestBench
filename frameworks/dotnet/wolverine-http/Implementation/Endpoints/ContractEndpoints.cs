using System.Reflection;
using System.Runtime.InteropServices;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public static class ContractEndpoints
{
    // The payloads are loaded before the server starts, so a server that answers has them.
    [WolverineGet("/health")]
    public static string Health() => "ok";

    [WolverineGet("/__meta")]
    public static Meta Describe() =>
        new("Wolverine.HTTP", Version(typeof(WolverineHttpOptions).Assembly), RuntimeInformation.FrameworkDescription, "", Boot.Ms);

    /// <summary>The version the restore resolved, without the source revision after the plus.</summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
