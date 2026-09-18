using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// parameters: router captures with segment depth held constant, each bound as an integer
/// and echoed.
///
/// A method parameter named after the capture is the binding, and its type is the conversion
/// Wolverine generates into the endpoint before the method runs. The static path also matches
/// /parameters/{one}/segment/literal, and routing prefers the literal segment whatever order
/// the methods are declared in.
/// </summary>
public static class ParametersEndpoints
{
    [WolverineGet("/parameters/static/segment/literal")]
    public static PayloadBody StaticPath(DomainModel domain) => domain.Payload("small");

    [WolverineGet("/parameters/{one}/segment/literal")]
    public static PayloadWithEcho One(int one, DomainModel domain) =>
        domain.WithEcho("small", new { one });

    [WolverineGet("/parameters/{one}/with-second/{two}")]
    public static PayloadWithEcho Two(int one, int two, DomainModel domain) =>
        domain.WithEcho("small", new { one, two });
}
