using Carter;
using RequestBench.Hosts;

namespace RequestBench.CarterTarget.Routes;

/// <summary>baseline: dispatch floor, no serialization.</summary>
public sealed class Baseline : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/plaintext", () => Results.Text("Hello, World!"));

        app.MapGet("/health", () => Results.Text("ok"));

        app.MapGet("/__meta", () => HostInfo.Meta("carter", HostInfo.Version(typeof(ICarterModule)), HostInfo.Razor));
    }
}
