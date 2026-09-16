using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// json: the serializer and response buffering across three size regimes.
///
/// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
/// router pay parameter cost on the family every other target serves from a static route.
/// </summary>
public static class JsonEndpoints
{
    [WolverineGet("/json/small")]
    public static PayloadBody Small(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/json/medium")]
    public static PayloadBody Medium(DomainModel domain) => domain.Payload("medium");

    [WolverineGet("/json/large")]
    public static PayloadBody Large(DomainModel domain) => domain.Payload("large");
}
