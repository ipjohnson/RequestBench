using Hardened.Web.Runtime.Attributes;

namespace Implementation.Routes;

/// <summary>
/// stream: items.medium's rows as NDJSON. A handler that returns IAsyncEnumerable is written one
/// line per item, each flushed as it is written, with no Content-Length.
/// </summary>
public class StreamRoutes(Payloads payloads)
{
    [Get("/stream/items")]
    public IAsyncEnumerable<Item> Items() => payloads.Medium.Items.ToAsyncEnumerable();
}
