using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// authorized: ASP.NET Core's authorization, which FastEndpoints applies to an endpoint that
/// names a policy. The token policy runs before the handler and forbids a token that is not
/// settings.json's.
/// </summary>
// rb:handler authorized.allowed,authorized.denied
public sealed class AuthorizedSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/authorized/small");
        Policies(Implementation.Policies.Token);
    }

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}
