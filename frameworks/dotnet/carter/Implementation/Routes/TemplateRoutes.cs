using Carter;
using Implementation.Components;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Implementation.Routes;

/// <summary>
/// template: Carter has no view layer of its own, and what ASP.NET Core ships for server-side
/// HTML is Razor. RazorComponentResult renders a component statically from an endpoint, and
/// the Web SDK compiles the component into the assembly at build.
/// </summary>
public sealed class TemplateRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/template/small", (Payloads p) => Page(p.Small));

        app.MapGet("/template/medium", (Payloads p) => Page(p.Medium));
    }

    // rb:wiring template.*
    private static RazorComponentResult<ItemsPage> Page(Payload payload) =>
        new(new Dictionary<string, object?> { [nameof(ItemsPage.Body)] = payload });
}
