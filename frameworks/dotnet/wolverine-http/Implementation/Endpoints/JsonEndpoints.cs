using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// json: a payload the framework already holds, serialised at three sizes. Wolverine writes any
/// other returned type as JSON.
/// </summary>
public static class JsonEndpoints
{
    [WolverineGet("/json/small")]
    public static Payload Small(Payloads p) => p.Small;

    [WolverineGet("/json/medium")]
    public static Payload Medium(Payloads p) => p.Medium;

    [WolverineGet("/json/large")]
    public static Payload Large(Payloads p) => p.Large;
}
