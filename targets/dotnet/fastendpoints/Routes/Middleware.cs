using FastEndpoints;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// A pre-processor is FastEndpoints' own per-endpoint layer, which is the scoping the family
/// needs. Middleware added to the application would run on all forty-five endpoints.
///
/// One class is one layer: PreProcessor&lt;T&gt;() registers by type, so a repeat of the same
/// type is one registration and the counts have to be distinct classes.
/// </summary>
public abstract class NoopLayer : IPreProcessor<EmptyRequest>
{
    public Task PreProcessAsync(IPreProcessorContext<EmptyRequest> context, CancellationToken ct) =>
        Task.CompletedTask;
}

public sealed class Noop00 : NoopLayer;

public sealed class Noop01 : NoopLayer;

public sealed class Noop02 : NoopLayer;

public sealed class Noop03 : NoopLayer;

public sealed class Noop04 : NoopLayer;

public sealed class Noop05 : NoopLayer;

public sealed class Noop06 : NoopLayer;

public sealed class Noop07 : NoopLayer;

public sealed class Noop08 : NoopLayer;

public sealed class Noop09 : NoopLayer;

public sealed class Noop10 : NoopLayer;

public sealed class Noop11 : NoopLayer;

public sealed class Noop12 : NoopLayer;

public sealed class Noop13 : NoopLayer;

public sealed class Noop14 : NoopLayer;

public sealed class Noop15 : NoopLayer;

public sealed class MiddlewareNoneEndpoint(DomainModel domain)
    : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/middleware/none");
        AllowAnonymous();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}

public sealed class MiddlewareFourEndpoint(DomainModel domain)
    : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/middleware/four");
        AllowAnonymous();
        PreProcessor<Noop00>();
        PreProcessor<Noop01>();
        PreProcessor<Noop02>();
        PreProcessor<Noop03>();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}

public sealed class MiddlewareSixteenEndpoint(DomainModel domain)
    : EndpointWithoutRequest<PayloadBody>
{
    public override void Configure()
    {
        Get("/middleware/sixteen");
        AllowAnonymous();
        PreProcessor<Noop00>();
        PreProcessor<Noop01>();
        PreProcessor<Noop02>();
        PreProcessor<Noop03>();
        PreProcessor<Noop04>();
        PreProcessor<Noop05>();
        PreProcessor<Noop06>();
        PreProcessor<Noop07>();
        PreProcessor<Noop08>();
        PreProcessor<Noop09>();
        PreProcessor<Noop10>();
        PreProcessor<Noop11>();
        PreProcessor<Noop12>();
        PreProcessor<Noop13>();
        PreProcessor<Noop14>();
        PreProcessor<Noop15>();
    }

    public override Task<PayloadBody> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(domain.Payload("small"));
}
