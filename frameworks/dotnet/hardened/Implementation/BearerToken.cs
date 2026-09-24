using DependencyModules.Runtime.Attributes;
using Hardened.Requests.Abstract.Authorization;
using Hardened.Requests.Abstract.Execution;

namespace Implementation;

// rb:wiring authorized.*
/// <summary>The scheme a bearer token authenticates its caller under.</summary>
[HttpAuthenticationScheme("bearer")]
public sealed class BearerToken : IAuthenticationScheme;

/// <summary>What a caller may do, as the grants /authorized/small requires.</summary>
public static class Grants
{
    public const string ReadSmall = "small:read";
}

/// <summary>
/// Reads a bearer token into the caller. Hardened ships no source for a credential and has the
/// application write its own. Any bearer token authenticates its caller, and only settings.json's
/// token carries the grant, so a wrong token is authenticated and then refused, which is a 403.
/// </summary>
[SingletonService]
public sealed class BearerTokenSource(Payloads payloads) : IPrincipalSource<BearerToken>
{
    private const string Prefix = "Bearer ";

    public ValueTask<ICallerPrincipal?> Authenticate(IExecutionContext context)
    {
        if (!context.Request.Headers.TryGetValue("Authorization", out var header)
            || header.ToString() is not { } value
            || !value.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return ValueTask.FromResult<ICallerPrincipal?>(null);
        }

        string[] grants = value.AsSpan(Prefix.Length).SequenceEqual(payloads.Settings.Token) ? [Grants.ReadSmall] : [];
        return ValueTask.FromResult<ICallerPrincipal?>(new CallerPrincipal("bearer", grants));
    }
}
// rb:end
