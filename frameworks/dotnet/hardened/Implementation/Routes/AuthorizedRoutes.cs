using Hardened.Requests.Runtime.Authorization;
using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// authorized: Hardened's authorization, which checks the caller's grants before the request is
/// bound. BearerTokenSource reads the token into the caller on every request.
/// </summary>
public class AuthorizedRoutes(Payloads payloads)
{
    [Get("/authorized/small")]
    [AuthorizeGrants(Grants.ReadSmall)]
    public Payload Small() => payloads.Small;
}
