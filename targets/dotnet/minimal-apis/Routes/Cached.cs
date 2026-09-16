using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// cached: validator headers and the conditional request.
///
/// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
/// rather than hashing the body. The size is closed over rather than read back out of the
/// path, and the comparison requires a non-empty header: matching a missing if-none-match
/// against an empty ETag answers 304 to a client that never asked a conditional question.
/// </summary>
public static class Cached
{
    private static Func<HttpContext, DomainModel, IResult> Serve(string size) =>
        (context, model) =>
        {
            string etag = model.ETagOf(size);
            HttpResponse response = context.Response;
            response.Headers.ETag = etag;
            response.Headers.CacheControl = DomainModel.Cacheable;
            response.Headers["x-rb-serial"] = model.NextSerial();
            string inm = context.Request.Headers.IfNoneMatch.ToString();
            return inm.Length > 0 && inm == etag
                ? Results.StatusCode(304)
                : Results.Json(model.Payload(size));
        };

    public static void Map(WebApplication app)
    {
        app.MapGet("/cached/small", Serve("small"));

        app.MapGet("/cached/medium", Serve("medium"));

        app.MapGet("/cached/large", Serve("large"));
    }
}
