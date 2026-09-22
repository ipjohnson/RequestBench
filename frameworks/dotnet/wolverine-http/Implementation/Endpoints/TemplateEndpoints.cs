using Implementation.Components;
using Microsoft.AspNetCore.Http.HttpResults;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// template: Wolverine has no view layer of its own, and what ASP.NET Core ships for server-side
/// HTML is Razor. RazorComponentResult renders a component statically, Wolverine executes it
/// as it executes any IResult, and the Web SDK compiles the component into the assembly at build.
/// </summary>
public static class TemplateEndpoints
{
    [WolverineGet("/template/small")]
    public static RazorComponentResult<ItemsPage> Small(Payloads p) => Page(p.Small);

    [WolverineGet("/template/medium")]
    public static RazorComponentResult<ItemsPage> Medium(Payloads p) => Page(p.Medium);

    // rb:wiring template.*
    private static RazorComponentResult<ItemsPage> Page(Payload payload) =>
        new(new Dictionary<string, object?> { [nameof(ItemsPage.Body)] = payload });
}
