using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// template: MVC's own view layer, Razor. The action names a view and passes the payload as its
/// model, and the view engine finds Views/Template/ItemsPage.cshtml, which the Web SDK compiled
/// into the assembly at build. The controller derives from Controller, which carries View(),
/// and is no [ApiController], because it answers HTML.
/// </summary>
public sealed class TemplateController(Payloads payloads) : Controller
{
    [HttpGet("/template/small")]
    public ViewResult Small() => View("ItemsPage", payloads.Small);

    [HttpGet("/template/medium")]
    public ViewResult Medium() => View("ItemsPage", payloads.Medium);
}
