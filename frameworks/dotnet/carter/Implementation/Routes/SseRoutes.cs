using Carter;

namespace Implementation.Routes;

/// <summary>
/// sse: items.medium's rows as server-sent events, through ASP.NET Core 10's own result for
/// them, which serialises each row with the configured JSON options and flushes it as one event.
/// </summary>
public sealed class SseRoutes : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/sse/medium", (Payloads p) => TypedResults.ServerSentEvents(p.Medium.Items.ToAsyncEnumerable()));
    }
}
