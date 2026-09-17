using Carter;
using Microsoft.AspNetCore.Http.HttpResults;
using RequestBench.CarterTarget.Components;
using RequestBench.Domain;

namespace RequestBench.CarterTarget.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// Carter documents no view story of its own, but it runs on ASP.NET Core, and what
/// ASP.NET Core ships is Razor. RazorComponentResult is how an endpoint outside MVC renders
/// one: it names a component and passes parameters, and the framework renders it
/// statically. The Web SDK compiles the component into the assembly at build, so nothing is
/// parsed per request.
/// </summary>
public sealed class Templates : ICarterModule
{
    // rb:wiring template.*
    private static RazorComponentResult<Items> Render(PayloadBody body) =>
        new(new Dictionary<string, object?> { ["Body"] = body });

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/template/small", (DomainModel d) => Render(d.Payload("small")));

        app.MapGet("/template/medium", (DomainModel d) => Render(d.Payload("medium")));
    }
}
