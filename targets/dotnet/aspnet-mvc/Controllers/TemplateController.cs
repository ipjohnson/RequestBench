using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc.Controllers;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// MVC's own view engine, which is Razor: the action returns a view name and a model and
/// the view engine finds Views/Template/Items.cshtml. The Web SDK compiles the view into
/// the assembly at build, so nothing is parsed per request and a precomputed string would
/// measure nothing.
///
/// This derives from Controller rather than ControllerBase, which is what carries View(),
/// and it is not an [ApiController]: that attribute is for the JSON families.
/// </summary>
public sealed class TemplateController(DomainModel domain) : Controller
{
    [HttpGet("/template/small")]
    public IActionResult Small() => View("Items", domain.Payload("small"));

    [HttpGet("/template/medium")]
    public IActionResult Medium() => View("Items", domain.Payload("medium"));
}
