using Microsoft.AspNetCore.Http.HttpResults;
using RequestBench.Domain;
using RequestBench.MinimalApis.Components;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// Minimal APIs document no view story of their own, but they run on ASP.NET Core, and
/// what ASP.NET Core ships is Razor. RazorComponentResult is how a minimal endpoint
/// renders one: the endpoint names a component and passes parameters, and the framework
/// renders it statically. The Web SDK compiles the component into the assembly at build,
/// so nothing is parsed per request.
/// </summary>
public static class Templates
{
    // rb:wiring template.*
    private static RazorComponentResult<Items> Render(PayloadBody body) =>
        new(new Dictionary<string, object?> { ["Body"] = body });

    public static void Map(WebApplication app)
    {
        app.MapGet("/template/small", (DomainModel d) => Render(d.Payload("small")));

        app.MapGet("/template/medium", (DomainModel d) => Render(d.Payload("medium")));
    }
}
