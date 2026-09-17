using FastEndpoints;
using RequestBench.Hosts;

namespace RequestBench.FastEndpointsTarget.Routes;

/// <summary>
/// baseline: dispatch floor, no serialization.
///
/// A family is a file and FastEndpoints wants a class per endpoint, so the classes for one
/// family sit together here. The framework finds them by scanning the assembly.
/// </summary>
// rb:handler baseline.plaintext
public sealed class PlaintextEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/plaintext");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct) =>
        HttpContext.Response.SendStringAsync("Hello, World!", cancellation: ct);
}

public sealed class HealthEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/health");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct) =>
        HttpContext.Response.SendStringAsync("ok", cancellation: ct);
}

public sealed class MetaEndpoint : EndpointWithoutRequest<IReadOnlyDictionary<string, string>>
{
    public override void Configure()
    {
        Get("/__meta");
        AllowAnonymous();
    }

    public override Task<IReadOnlyDictionary<string, string>> ExecuteAsync(CancellationToken ct) =>
        Task.FromResult(HostInfo.Meta("fastendpoints", HostInfo.Version(typeof(IEndpoint)), HostInfo.Razor));
}
