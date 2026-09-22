using System.Text.Json;
using FastEndpoints;

namespace Implementation.Endpoints;

/// <summary>
/// stream: items.medium's rows written one per line and flushed as each is written, from the
/// handler, because FastEndpoints has no send method for a stream of JSON lines. The length is
/// never known, so the answer goes out chunked.
/// </summary>
// rb:handler stream.ndjson
public sealed class StreamItemsEndpoint(Payloads payloads) : EndpointWithoutRequest
{
    private static readonly byte[] NewLine = "\n"u8.ToArray();

    public override void Configure() => Get("/stream/items");

    public override async Task HandleAsync(CancellationToken ct)
    {
        HttpResponse response = HttpContext.Response;
        response.ContentType = "application/x-ndjson";
        foreach (Item row in payloads.Medium.Items)
        {
            await JsonSerializer.SerializeAsync(response.Body, row, JsonContext.Default.Item, ct);
            await response.Body.WriteAsync(NewLine, ct);
            await response.Body.FlushAsync(ct);
        }
    }
}
