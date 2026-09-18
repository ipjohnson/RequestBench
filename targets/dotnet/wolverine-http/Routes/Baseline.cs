using RequestBench.Domain;
using RequestBench.Hosts;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>baseline: dispatch floor, no serialization.</summary>
public static class BaselineEndpoints
{
    [WolverineGet("/plaintext")]
    public static IResult Plaintext() => Results.Text("Hello, World!");

    [WolverineGet("/health")]
    public static IResult Health() => Results.Text("ok");

    [WolverineGet("/__meta")]
    public static IReadOnlyDictionary<string, object> Meta() =>
        HostInfo.Meta("wolverine-http", HostInfo.Version(typeof(WolverineGetAttribute)), HostInfo.Razor);
}
