using Carter;

namespace Implementation.Routes;

/// <summary>
/// authorized: ASP.NET Core's authorization, which Carter routes use as minimal APIs do. The
/// token policy runs before the handler and forbids a token that is not settings.json's.
/// </summary>
public sealed class AuthorizedRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/authorized/small", (Payloads p) => p.Small).RequireAuthorization(Policies.Token);
    }
}
