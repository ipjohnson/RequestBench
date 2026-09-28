namespace Implementation.Routes;

/// <summary>
/// authorized: ASP.NET Core's authorization, required on this one route. The token policy runs
/// before the handler and forbids any token but the one it names.
/// </summary>
public static class AuthorizedRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/authorized/small", (Payloads p) => p.Small).RequireAuthorization(Policies.Token);
    }
}
