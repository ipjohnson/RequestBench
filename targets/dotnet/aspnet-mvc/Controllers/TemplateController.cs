using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// The engine is scriban, shared with every other .NET target and named on /__meta. MVC's
/// own view engine is Razor, and the engine is pinned for the same reason the gzip level is.
/// </summary>
[ApiController]
public sealed class TemplateController(DomainModel domain) : ControllerBase
{
    [HttpGet("/template/small")]
    public ContentResult Small() =>
        Content(Views.RenderItems(domain.Payload("small")), "text/html");

    [HttpGet("/template/medium")]
    public ContentResult Medium() =>
        Content(Views.RenderItems(domain.Payload("medium")), "text/html");
}
