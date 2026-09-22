using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
[ApiController]
public sealed class ContractController : ControllerBase
{
    // The payloads are loaded before the server starts, so a server that answers has them.
    [HttpGet("/health")]
    public ContentResult Health() => Content("ok", "text/plain");

    [HttpGet("/__meta")]
    public Meta About() => new("ASP.NET Core MVC", Version(typeof(ControllerBase).Assembly), RuntimeInformation.FrameworkDescription, "", Boot.Ms);

    /// <summary>
    /// The version of the MVC assembly the shared framework loaded, without the source revision
    /// after the plus.
    /// </summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
