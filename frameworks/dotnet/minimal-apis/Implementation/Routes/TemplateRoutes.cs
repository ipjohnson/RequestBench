using Implementation.Components;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Implementation.Routes;

/// <summary>
/// template: minimal APIs have no view layer of their own, and what ASP.NET Core ships for
/// server-side HTML is Razor. RazorComponentResult renders a component statically from an
/// endpoint, and the Web SDK compiles the component into the assembly at build.
/// </summary>
public static class TemplateRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/template/small", (Payloads p) => Page(p.Small));

        app.MapGet("/template/medium", (Payloads p) => Page(p.Medium));
    }

    // rb:wiring template.*
    // A native build compiles the routes with the request delegate generator, which cannot see
    // ItemsPage, because the Razor generator writes it. So the handlers return the base class.
    private static RazorComponentResult Page(Payload payload) =>
        new RazorComponentResult<ItemsPage>(new Dictionary<string, object?> { [nameof(ItemsPage.Body)] = payload });
}
