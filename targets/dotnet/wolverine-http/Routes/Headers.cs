using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// headers: eager against lazy construction of the request header map.
///
/// The handler reads no header at all, so headers.many minus headers.few is the cost of
/// materialising 27 nobody asked for.
/// </summary>
public static class HeadersEndpoints
{
    [WolverineGet("/headers")]
    public static PayloadBody Headers(DomainModel domain) => domain.Payload("small");
}
