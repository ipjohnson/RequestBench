using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// middleware: no-op layers in front of the handler. A pre-processor is FastEndpoints' own
/// per-endpoint layer. Middleware added to the application would run on every route rather
/// than on these two.
/// </summary>
// rb:handler middleware.none
public sealed class MiddlewareNoneEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure() => Get("/middleware/none");

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:handler middleware.four
public sealed class MiddlewareFourEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/middleware/four");
        PreProcessor<Layer01>();
        PreProcessor<Layer02>();
        PreProcessor<Layer03>();
        PreProcessor<Layer04>();
    }

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:handler middleware.sixteen
public sealed class MiddlewareSixteenEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/middleware/sixteen");
        PreProcessor<Layer01>();
        PreProcessor<Layer02>();
        PreProcessor<Layer03>();
        PreProcessor<Layer04>();
        PreProcessor<Layer05>();
        PreProcessor<Layer06>();
        PreProcessor<Layer07>();
        PreProcessor<Layer08>();
        PreProcessor<Layer09>();
        PreProcessor<Layer10>();
        PreProcessor<Layer11>();
        PreProcessor<Layer12>();
        PreProcessor<Layer13>();
        PreProcessor<Layer14>();
        PreProcessor<Layer15>();
        PreProcessor<Layer16>();
    }

    public override Task HandleAsync(CancellationToken ct) => Send.OkAsync(payloads.Small, ct);
}

// rb:wiring middleware.*
/// <summary>
/// One no-op layer. FastEndpoints keeps one processor of each type on an endpoint and drops a
/// repeat, so every layer is a type of its own.
/// </summary>
public abstract class Layer : IPreProcessor<EmptyRequest>
{
    public Task PreProcessAsync(IPreProcessorContext<EmptyRequest> context, CancellationToken ct) => Task.CompletedTask;
}

public sealed class Layer01 : Layer;

public sealed class Layer02 : Layer;

public sealed class Layer03 : Layer;

public sealed class Layer04 : Layer;

public sealed class Layer05 : Layer;

public sealed class Layer06 : Layer;

public sealed class Layer07 : Layer;

public sealed class Layer08 : Layer;

public sealed class Layer09 : Layer;

public sealed class Layer10 : Layer;

public sealed class Layer11 : Layer;

public sealed class Layer12 : Layer;

public sealed class Layer13 : Layer;

public sealed class Layer14 : Layer;

public sealed class Layer15 : Layer;

public sealed class Layer16 : Layer;
// rb:end
