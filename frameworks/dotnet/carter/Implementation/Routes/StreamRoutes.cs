using System.Text.Json;
using Carter;

namespace Implementation.Routes;

/// <summary>
/// stream: items.medium's rows written one per line and flushed as each is written, through
/// minimal APIs' stream result. The length is never known, so the answer goes out chunked.
/// </summary>
public sealed class StreamRoutes : ICarterModule
{
    private static readonly byte[] NewLine = "\n"u8.ToArray();

    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapGet("/stream/items", (Payloads p) => Results.Stream(async body =>
        {
            foreach (Item row in p.Medium.Items)
            {
                await JsonSerializer.SerializeAsync(body, row, JsonContext.Default.Item);
                await body.WriteAsync(NewLine);
                await body.FlushAsync();
            }
        }, "application/x-ndjson"));
    }
}
