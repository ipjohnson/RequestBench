using Microsoft.AspNetCore.Http.HttpResults;
using RequestBench.Domain;
using RequestBench.WolverineTarget.Components;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// Wolverine.HTTP documents no view story of its own, but it runs on ASP.NET Core, and what
/// ASP.NET Core ships is Razor. RazorComponentResult is how an endpoint outside MVC renders
/// one: it names a component and passes parameters, and the framework renders it
/// statically. The Web SDK compiles the component into the assembly at build, so nothing is
/// parsed per request.
/// </summary>
public static class TemplateEndpoints
{
    // rb:wiring template.*
    private static RazorComponentResult<Items> Render(PayloadBody body) =>
        new(new Dictionary<string, object?> { ["Body"] = body });

    [WolverineGet("/template/small")]
    public static RazorComponentResult<Items> Small(DomainModel domain) =>
        Render(domain.Payload("small"));

    [WolverineGet("/template/medium")]
    public static RazorComponentResult<Items> Medium(DomainModel domain) =>
        Render(domain.Payload("medium"));
}
