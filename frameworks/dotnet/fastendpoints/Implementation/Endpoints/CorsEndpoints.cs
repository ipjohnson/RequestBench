using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// cors: ASP.NET Core's CORS feature, attached to this endpoint through its route builder and
/// nowhere else. It answers a preflight before any handler runs. The handler writes
/// x-rb-serial, so its absence on a preflight shows the feature answered alone.
/// </summary>
// rb:handler cors.request,cors.vary
public sealed class CorsSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/cors/small");
        // rb:wiring cors.*
        Options(b => b.RequireCors(Implementation.Policies.Cors));
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.OkAsync(payloads.Small, ct);
    }
}
