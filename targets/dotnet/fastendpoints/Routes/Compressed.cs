using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// These endpoints answer like any other. The response compression middleware that
/// Program.cs installs on the whole application gzips the answer when the request asks for
/// it, at the provider's default level, Fastest, with no minimum size.
/// </summary>
public abstract class CompressedEndpoint(DomainModel domain, string size)
    : EndpointWithoutRequest
{
    public override Task<object?> ExecuteAsync(CancellationToken ct)
    {
        HttpContext.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return Task.FromResult<object?>(domain.Payload(size));
    }
}

// rb:handler compressed.identity_small,compressed.gzip_small
public sealed class CompressedSmallEndpoint(DomainModel domain)
    : CompressedEndpoint(domain, "small")
{
    public override void Configure()
    {
        Get("/compressed/small");
        AllowAnonymous();
    }
}

public sealed class CompressedMediumEndpoint(DomainModel domain)
    : CompressedEndpoint(domain, "medium")
{
    public override void Configure()
    {
        Get("/compressed/medium");
        AllowAnonymous();
    }
}

// rb:handler compressed.identity_large,compressed.gzip_large
public sealed class CompressedLargeEndpoint(DomainModel domain)
    : CompressedEndpoint(domain, "large")
{
    public override void Configure()
    {
        Get("/compressed/large");
        AllowAnonymous();
    }
}
