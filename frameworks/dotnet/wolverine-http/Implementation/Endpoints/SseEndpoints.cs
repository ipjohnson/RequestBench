using Microsoft.AspNetCore.Http.HttpResults;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// sse: items.medium's rows as server-sent events, through ASP.NET Core 10's own result for
/// them, which Wolverine executes. It serialises each row with the configured JSON options and
/// flushes it as one event.
/// </summary>
public static class SseEndpoints
{
    [WolverineGet("/sse/medium")]
    public static ServerSentEventsResult<Item> Medium(Payloads p) => TypedResults.ServerSentEvents(p.Medium.Items.ToAsyncEnumerable());
}
