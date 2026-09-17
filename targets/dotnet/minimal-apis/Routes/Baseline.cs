using RequestBench.Hosts;

namespace RequestBench.MinimalApis.Routes;

/// <summary>baseline: dispatch floor, no serialization.</summary>
public static class Baseline
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/plaintext", () => Results.Text("Hello, World!"));

        app.MapGet("/health", () => Results.Text("ok"));

        app.MapGet("/__meta", () => HostInfo.Meta(
            "minimal-apis", HostInfo.Version(typeof(WebApplication)), HostInfo.Razor));
    }
}
