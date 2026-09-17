using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// Wolverine generates a handler and hands the result to ASP.NET, whose response
/// compression middleware sits on the application; that would put a "did the client ask?"
/// check on all forty-five endpoints and contaminate the rows this family is measured
/// against. These three carry the codec themselves so the other forty-two do not, and it is
/// the pinned codec and floor every language shares.
/// </summary>
public static class CompressedEndpoints
{
    // rb:wiring compressed.*
    private static IResult Serve(HttpContext context, DomainModel domain, string size)
    {
        HttpResponse response = context.Response;
        response.Headers["x-rb-serial"] = domain.NextSerial();
        byte[] raw = Json.Bytes(domain.Payload(size));
        string accept = context.Request.Headers.AcceptEncoding.ToString();
        if (!accept.Contains("gzip", StringComparison.Ordinal)
            || raw.Length < DomainModel.GzipMinSize)
        {
            return Results.Bytes(raw, "application/json");
        }
        response.Headers.ContentEncoding = "gzip";
        response.Headers.Vary = "Accept-Encoding";
        return Results.Bytes(DomainModel.Gzip(raw), "application/json");
    }

    [WolverineGet("/compressed/small")]
    public static IResult Small(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small");

    [WolverineGet("/compressed/medium")]
    public static IResult Medium(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "medium");

    [WolverineGet("/compressed/large")]
    public static IResult Large(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "large");
}
