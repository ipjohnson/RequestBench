using RequestBench.Domain;
using RequestBench.Hosts;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// template: server-side rendering of the same model the json family serializes.
///
/// The engine is scriban, shared with every other .NET target and named on /__meta.
/// </summary>
public static class Templates
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/template/small", (DomainModel d) =>
            Results.Content(Views.RenderItems(d.Payload("small")), "text/html"));

        app.MapGet("/template/medium", (DomainModel d) =>
            Results.Content(Views.RenderItems(d.Payload("medium")), "text/html"));
    }
}
