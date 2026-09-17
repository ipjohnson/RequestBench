using RequestBench.Domain;
using Wolverine.Attributes;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// authorized: the framework's authorization mechanism, crypto excluded.
///
/// Middleware named on the one endpoint, not an if in the handler. An if would measure the
/// language; the point of the family is the framework's own plumbing. A Before that returns
/// a result stops the chain, which is how Wolverine refuses a request.
/// </summary>
// rb:wiring authorized.*
public static class RequireToken
{
    public static IResult? Before(HttpRequest request, DomainModel domain) =>
        domain.TokenOk(request.Headers.Authorization) ? null : Results.Problem(statusCode: 403);
}

public static class AuthorizedEndpoints
{
    [WolverineGet("/authorized/small")]
    [Middleware(typeof(RequireToken))]
    public static PayloadBody Small(DomainModel domain) => domain.Payload("small");
}
