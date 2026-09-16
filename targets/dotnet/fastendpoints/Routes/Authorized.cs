using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// authorized: the framework's authorization mechanism, crypto excluded.
///
/// A pre-processor on the one endpoint, not an if in the handler. An if would measure the
/// language; the point of the family is the framework's own plumbing. A pre-processor
/// refuses a request by writing the response and marking it handled.
/// </summary>
public sealed class RequireToken(DomainModel domain) : IPreProcessor<EmptyRequest>
{
    public async Task PreProcessAsync(IPreProcessorContext<EmptyRequest> context,
                                      CancellationToken ct)
    {
        string? header = context.HttpContext.Request.Headers.Authorization;
        if (domain.TokenOk(header))
        {
            return;
        }
        context.HttpContext.Response.StatusCode = 403;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { statusCode = 403, message = "forbidden" }, ct);
    }
}

public sealed class AuthorizedEndpoint(DomainModel domain) : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/authorized/small");
        AllowAnonymous();
        PreProcessor<RequireToken>();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}
