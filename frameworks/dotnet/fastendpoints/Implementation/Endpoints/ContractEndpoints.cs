using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public sealed class HealthEndpoint : EndpointWithoutRequest
{
    public override void Configure() => Get("/health");

    // The payloads are loaded before the server starts, so a server that answers has them.
    public override Task HandleAsync(CancellationToken ct) => Send.StringAsync("ok", cancellation: ct);
}

public sealed class MetaEndpoint : EndpointWithoutRequest<Meta>
{
    public override void Configure() => Get("/__meta");

    public override Task HandleAsync(CancellationToken ct) =>
        Send.OkAsync(new Meta("FastEndpoints", Version(typeof(IEndpoint).Assembly), Runtime(), Boot.Ms), ct);

    /// <summary>The runtime's description, and Native AOT after it in a native build, which cannot generate code at runtime.</summary>
    private static string Runtime() =>
        RuntimeFeature.IsDynamicCodeSupported ? RuntimeInformation.FrameworkDescription : $"{RuntimeInformation.FrameworkDescription} Native AOT";

    /// <summary>The version the restore resolved, without the source revision after the plus.</summary>
    private static string Version(Assembly assembly)
    {
        string? informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        int plus = informational?.IndexOf('+') ?? -1;
        return plus > 0 ? informational![..plus] : informational ?? assembly.GetName().Version?.ToString() ?? "";
    }
}
