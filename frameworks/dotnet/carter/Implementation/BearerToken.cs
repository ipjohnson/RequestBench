using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Implementation;

// rb:wiring authorized.*
/// <summary>
/// Reads a bearer token into a claim. ASP.NET Core ships no scheme for an opaque token, and
/// a scheme is where its authorization learns who is asking. The token policy compares the
/// claim, so a wrong token is authenticated and then forbidden, which is a 403.
/// </summary>
public sealed class BearerToken(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "bearer";

    public const string TokenClaim = "token";

    private const string Prefix = "Bearer ";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? header = Request.Headers.Authorization;
        if (header is null || !header.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }
        ClaimsIdentity identity = new([new Claim(TokenClaim, header[Prefix.Length..])], Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
    }
}
