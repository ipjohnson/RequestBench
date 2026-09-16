using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// Scoped to these three endpoints. ASP.NET's response compression middleware sits on the
/// application, which would put a "did the client ask?" check on all forty-five endpoints
/// and contaminate the rows this family is measured against.
///
/// The codec and the floor are the pinned ones every language shares.
/// </summary>
public abstract class CompressedEndpoint(DomainModel domain, string size)
    : EndpointWithoutRequest
{
    public override async Task HandleAsync(CancellationToken ct)
    {
        HttpResponse response = HttpContext.Response;
        response.Headers["x-rb-serial"] = domain.NextSerial();
        byte[] raw = Json.Bytes(domain.Payload(size));
        string accept = HttpContext.Request.Headers.AcceptEncoding.ToString();
        if (accept.Contains("gzip", StringComparison.Ordinal) && raw.Length >= DomainModel.GzipMinSize)
        {
            response.Headers.ContentEncoding = "gzip";
            response.Headers.Vary = "Accept-Encoding";
            raw = DomainModel.Gzip(raw);
        }
        response.ContentType = "application/json";
        await response.Body.WriteAsync(raw, ct);
    }
}

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

public sealed class CompressedLargeEndpoint(DomainModel domain)
    : CompressedEndpoint(domain, "large")
{
    public override void Configure()
    {
        Get("/compressed/large");
        AllowAnonymous();
    }
}
