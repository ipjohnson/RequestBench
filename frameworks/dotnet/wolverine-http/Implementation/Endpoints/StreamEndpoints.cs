using System.Text.Json;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// stream: items.medium's rows written one per line and flushed as each is written, through
/// ASP.NET Core's stream result, which Wolverine executes. The length is never known, so the
/// answer goes out chunked.
/// </summary>
public static class StreamEndpoints
{
    private static readonly byte[] NewLine = "\n"u8.ToArray();

    [WolverineGet("/stream/items")]
    public static IResult Items(Payloads p) => Results.Stream(async body =>
    {
        foreach (Item row in p.Medium.Items)
        {
            await JsonSerializer.SerializeAsync(body, row, JsonContext.Default.Item);
            await body.WriteAsync(NewLine);
            await body.FlushAsync();
        }
    }, "application/x-ndjson");
}
