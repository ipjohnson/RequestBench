using Microsoft.AspNetCore.Authorization;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// authorized: ASP.NET Core's authorization. Wolverine copies the endpoint method's attributes onto
/// the route, so the token policy runs before the handler and forbids a token that is not
/// settings.json's.
/// </summary>
public static class AuthorizedEndpoints
{
    [WolverineGet("/authorized/small")]
    [Authorize(Policy = Policies.Token)]
    public static Payload Small(Payloads p) => p.Small;
}
