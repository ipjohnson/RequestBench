using RequestBench.Domain;
using RequestBench.Hosts;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// The engine is scriban, shared with every other .NET target and named on /__meta.
/// </summary>
public static class TemplateEndpoints
{
    [WolverineGet("/template/small")]
    public static IResult Small(DomainModel domain) =>
        Results.Content(Views.RenderItems(domain.Payload("small")), "text/html");

    [WolverineGet("/template/medium")]
    public static IResult Medium(DomainModel domain) =>
        Results.Content(Views.RenderItems(domain.Payload("medium")), "text/html");
}
