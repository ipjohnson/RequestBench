using System.Reflection;
using System.Runtime.InteropServices;

namespace Implementation.Routes;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public static class ContractRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        // The payloads are loaded before the server starts, so a server that answers has them.
        app.MapGet("/health", () => Results.Text("ok"));

        // Minimal APIs have no package of their own. They ship in the ASP.NET Core shared
        // framework, so the version is the one the shared framework's assemblies report.
        app.MapGet("/__meta", () => new Meta("ASP.NET Core minimal APIs", Version(typeof(WebApplication).Assembly), RuntimeInformation.FrameworkDescription, "", Boot.Ms));
    }

    /// <summary>The version the assembly reports, without the source revision after the plus.</summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
