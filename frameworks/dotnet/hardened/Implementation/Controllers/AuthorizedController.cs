using Hardened.Requests.Runtime.Authorization;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// authorized: Hardened's authorization, required on this one route. The grant is checked before
/// the handler runs. BearerTokenSource gives it only to settings.json's token.
/// </summary>
public static class AuthorizedController
{
    [Get("/authorized/small")]
    [Authorize<BearerAuth>]
    [AuthorizeGrants(BearerTokenSource.Grant)]
    public static Payload Small(IPayloads p) => p.Small;
}
