using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// cached: validator headers and the conditional request.
///
/// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
/// rather than hashing the body. The comparison requires a non-empty header: matching a
/// missing if-none-match against an empty ETag answers 304 to a client that never asked a
/// conditional question.
/// </summary>
public abstract class CachedEndpoint(DomainModel domain, string size) : EndpointWithoutRequest
{
    public override async Task HandleAsync(CancellationToken ct)
    {
        string etag = domain.ETagOf(size);
        HttpResponse response = HttpContext.Response;
        response.Headers.ETag = etag;
        response.Headers.CacheControl = DomainModel.Cacheable;
        response.Headers["x-rb-serial"] = domain.NextSerial();
        string inm = HttpContext.Request.Headers.IfNoneMatch.ToString();
        if (inm.Length > 0 && inm == etag)
        {
            // SendNotModifiedAsync rather than setting the status: FastEndpoints auto-sends
            // a 204 for a handler that returns without sending, which overwrote the 304.
            await response.SendNotModifiedAsync(ct);
            return;
        }
        await response.WriteAsJsonAsync(domain.Payload(size), Json.Options, ct);
    }
}

public sealed class CachedSmallEndpoint(DomainModel domain) : CachedEndpoint(domain, "small")
{
    public override void Configure()
    {
        Get("/cached/small");
        AllowAnonymous();
    }
}

public sealed class CachedMediumEndpoint(DomainModel domain) : CachedEndpoint(domain, "medium")
{
    public override void Configure()
    {
        Get("/cached/medium");
        AllowAnonymous();
    }
}

public sealed class CachedLargeEndpoint(DomainModel domain) : CachedEndpoint(domain, "large")
{
    public override void Configure()
    {
        Get("/cached/large");
        AllowAnonymous();
    }
}
