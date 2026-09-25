using Hardened.Web.Runtime.Attributes;

namespace Implementation.Controllers;

/// <summary>
/// stream: an IAsyncEnumerable answers as NDJSON. Hardened writes and flushes each row as the
/// handler yields it, and sends no length.
/// </summary>
public static class StreamController
{
    [Get("/stream/items")]
    public static IAsyncEnumerable<Item> Items(IPayloads p) => p.Medium.Items.ToAsyncEnumerable();
}
