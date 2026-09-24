using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// sse: items.medium's rows as server-sent events. [ServerSentEvents] frames each item the
/// handler yields as the data of one event and flushes it.
/// </summary>
public class SseRoutes(Payloads payloads)
{
    [Get("/sse/medium")]
    [ServerSentEvents]
    public IAsyncEnumerable<Item> Medium() => payloads.Medium.Items.ToAsyncEnumerable();
}
