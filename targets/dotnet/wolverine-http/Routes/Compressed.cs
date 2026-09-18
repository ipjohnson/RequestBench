using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// These endpoints answer like any other. The response compression middleware that
/// Program.cs installs on the whole application gzips the answer when the request asks for
/// it, at the provider's default level, Fastest, with no minimum size.
/// </summary>
public static class CompressedEndpoints
{
    // rb:wiring compressed.*
    private static PayloadBody Serve(HttpContext context, DomainModel domain, string size)
    {
        context.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return domain.Payload(size);
    }

    [WolverineGet("/compressed/small")]
    public static PayloadBody Small(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small");

    [WolverineGet("/compressed/medium")]
    public static PayloadBody Medium(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "medium");

    [WolverineGet("/compressed/large")]
    public static PayloadBody Large(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "large");
}
