using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// etag: the framework's own conditional-request machinery, which ASP.NET Core does not
/// have. Nothing in it computes a validator for a dynamic response, so the digest is the
/// shared one and /__meta says so.
///
/// The hook is a pipeline branch on /etag rather than an endpoint filter. FastEndpoints
/// writes the response itself from inside its own delegate, so a filter around it is handed
/// nothing to hash, and the branch is where the bytes actually are. Program.cs registers it.
/// </summary>
public abstract class EtagEndpoint(DomainModel domain, string size) : EndpointWithoutRequest
{
    public override Task<object?> ExecuteAsync(CancellationToken ct)
    {
        HttpContext.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Task.FromResult<object?>(domain.Payload(size));
    }
}

// rb:snippet etag.small etag.large etag.match_large etag.stale_large
public sealed class EtagSmallEndpoint(DomainModel domain) : EtagEndpoint(domain, "small")
{
    public override void Configure()
    {
        Get("/etag/small");
        AllowAnonymous();
    }
}

public sealed class EtagLargeEndpoint(DomainModel domain) : EtagEndpoint(domain, "large")
{
    public override void Configure()
    {
        Get("/etag/large");
        AllowAnonymous();
    }
}
