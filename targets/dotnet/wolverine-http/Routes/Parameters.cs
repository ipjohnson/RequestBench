using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>parameters: router captures with segment depth held constant.</summary>
public static class ParametersEndpoints
{
    [WolverineGet("/parameters/static/segment/literal")]
    public static PayloadBody StaticPath(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/parameters/{one}")]
    public static PayloadBody One(string one, DomainModel domain) => domain.Payload("small");

    [WolverineGet("/parameters/{one}/with-second/{two}")]
    public static PayloadBody Two(string one, string two, DomainModel domain) =>
        domain.Payload("small");
}
