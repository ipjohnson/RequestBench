using System.Reflection;
using System.Runtime.InteropServices;
using Carter;

namespace Implementation.Routes;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public sealed class ContractRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        // The payloads are loaded before the server starts, so a server that answers has them.
        app.MapGet("/health", () => Results.Text("ok"));

        app.MapGet("/__meta", () => new Meta("Carter", Version(typeof(ICarterModule).Assembly), RuntimeInformation.FrameworkDescription, "", Boot.Ms));
    }

    /// <summary>The version the restore resolved, without the source revision after the plus.</summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
