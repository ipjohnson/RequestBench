using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// cached: validator headers and the conditional request.
///
/// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
/// rather than hashing the body. The comparison requires a non-empty header: matching a
/// missing if-none-match against an empty ETag answers 304 to a client that never asked a
/// conditional question.
/// </summary>
public static class CachedEndpoints
{
    private static IResult Serve(HttpContext context, DomainModel domain, string size)
    {
        string etag = domain.ETagOf(size);
        HttpResponse response = context.Response;
        response.Headers.ETag = etag;
        response.Headers.CacheControl = DomainModel.Cacheable;
        response.Headers["x-rb-serial"] = domain.NextSerial();
        string inm = context.Request.Headers.IfNoneMatch.ToString();
        return inm.Length > 0 && inm == etag
            ? Results.StatusCode(304)
            : Results.Json(domain.Payload(size), Json.Options);
    }

    [WolverineGet("/cached/small")]
    public static IResult Small(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small");

    [WolverineGet("/cached/medium")]
    public static IResult Medium(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "medium");

    [WolverineGet("/cached/large")]
    public static IResult Large(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "large");
}
