using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// sse: [ServerSentEvents] frames the same stream as server-sent events, one row as the data of
/// each event.
/// </summary>
public static class SseController
{
    [Get("/sse/medium")]
    [ServerSentEvents]
    public static IAsyncEnumerable<Item> Medium(IPayloads p) => p.Medium.Items.ToAsyncEnumerable();
}
