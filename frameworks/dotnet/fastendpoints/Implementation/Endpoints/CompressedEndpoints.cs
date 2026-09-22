using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// compressed: these endpoints answer like any other. ASP.NET Core's response compression,
/// installed on the whole application, gzips the answer when the request asks for it.
/// </summary>
// rb:handler compressed.gzip_small,compressed.identity_small
public sealed class CompressedSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/compressed/small");

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Small, ct);
    }
}

// rb:handler compressed.gzip_large,compressed.identity_large
public sealed class CompressedLargeEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/compressed/large");

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Large, ct);
    }
}
