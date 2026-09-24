using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using Hardened.Requests.Abstract.Attributes;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public class ContractRoutes
{
    // The payloads are loaded while the modules are applied, so a server that answers has them.
    [Get("/health")]
    [Produces("text/plain")]
    public string Health() => "ok";

    [Get("/__meta")]
    public Meta Describe() => new("Hardened", Version(), Runtime(), "", Boot.Ms);

    /// <summary>The runtime's description, and Native AOT after it in a native build, which cannot generate code at runtime.</summary>
    private static string Runtime() =>
        RuntimeFeature.IsDynamicCodeSupported ? RuntimeInformation.FrameworkDescription : $"{RuntimeInformation.FrameworkDescription} Native AOT";

    /// <summary>The Hardened version the build stamped into this assembly, which the restore resolved.</summary>
    private static string Version() =>
        typeof(ContractRoutes).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().First(a => a.Key == "HardenedVersion").Value ?? "";
}
