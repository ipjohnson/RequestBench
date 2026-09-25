using DependencyModules.Runtime.Attributes;
using Hardened.Requests.Abstract.Authorization;
using Hardened.Requests.Abstract.Execution;

namespace Implementation;

// rb:wiring authorized.*
/// <summary>The scheme /authorized names, which the OpenAPI document publishes.</summary>
[HttpAuthenticationScheme("bearer")]
public sealed class BearerAuth : IAuthenticationScheme;

/// <summary>
/// Reads the bearer token. Hardened ships no principal source for a credential, and a source is
/// where its authorization learns who is asking. Every bearer token authenticates a caller, and
/// only settings.json's token holds the grant /authorized requires, so a wrong token is refused
/// with 403 rather than treated as anonymous.
/// </summary>
[SingletonService]
public sealed class BearerTokenSource(IPayloads payloads) : IPrincipalSource<BearerAuth>
{
    public const string Grant = "items:read";

    private const string Prefix = "Bearer ";

    private static readonly string[] Holds = [Grant];

    private readonly string token = payloads.Settings.Token;

    public ValueTask<ICallerPrincipal?> Authenticate(IExecutionContext context)
    {
        if (!context.Request.Headers.TryGetValue("Authorization", out var header))
        {
            return ValueTask.FromResult<ICallerPrincipal?>(null);
        }
        string value = header.ToString();
        if (!value.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return ValueTask.FromResult<ICallerPrincipal?>(null);
        }
        bool holds = string.Equals(value[Prefix.Length..], token, StringComparison.Ordinal);
        return ValueTask.FromResult<ICallerPrincipal?>(new CallerPrincipal("bearer", holds ? Holds : []));
    }
}
// rb:end
