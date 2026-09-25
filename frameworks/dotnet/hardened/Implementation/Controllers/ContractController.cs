using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public static class ContractController
{
    /// <summary>The Hardened.Web.Runtime package's version, as its assemblies are stamped.</summary>
    private static readonly string HardenedVersion = Version(typeof(GetAttribute).Assembly);

    /// <remarks>
    /// The payloads are loaded before any host starts, so a server that answers has them. Hardened's
    /// own /health/live and /health/ready answer with no body, and the contract asks for one.
    /// </remarks>
    [Get("/health")]
    [Produces("text/plain")]
    public static string Health() => "ok";

    [Get("/__meta")]
    public static Meta Meta() => new("Hardened", HardenedVersion, Runtime(), Boot.Ms);

    /// <summary>The runtime's description, and Native AOT after it in a native build, which cannot generate code at run time.</summary>
    private static string Runtime() =>
        RuntimeFeature.IsDynamicCodeSupported ? RuntimeInformation.FrameworkDescription : $"{RuntimeInformation.FrameworkDescription} Native AOT";

    /// <summary>The version the assembly reports, without the source revision after the plus.</summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
