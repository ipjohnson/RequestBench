using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// parameters: route captures, each bound by naming a method parameter after it, as the integer
/// its type says. Routing prefers the literal segment of the static route.
/// </summary>
public static class ParametersEndpoints
{
    [WolverineGet("/parameters/static/segment/literal")]
    public static Payload Static(Payloads p) => p.Small;

    [WolverineGet("/parameters/{one}/segment/literal")]
    public static Echoed<ParametersOne> One(int one, Payloads p) => new(p.Small, new(one));

    [WolverineGet("/parameters/{one}/with-second/{two}")]
    public static Echoed<ParametersTwo> Two(int one, int two, Payloads p) => new(p.Small, new(one, two));
}
