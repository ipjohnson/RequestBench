using Microsoft.AspNetCore.Mvc;
using RequestBench.Hosts;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>baseline: dispatch floor, no serialization.</summary>
[ApiController]
public sealed class BaselineController : ControllerBase
{
    // The content type is set on the result rather than with [Produces], which restricts
    // matching against the gate's Accept: application/json.
    [HttpGet("/plaintext")]
    public ContentResult Plaintext() => Content("Hello, World!", "text/plain");

    [HttpGet("/health")]
    public ContentResult Health() => Content("ok", "text/plain");

    [HttpGet("/__meta")]
    public IReadOnlyDictionary<string, object> Meta() =>
        HostInfo.Meta("aspnet-mvc", HostInfo.Version(typeof(ControllerBase)), HostInfo.Razor);
}
