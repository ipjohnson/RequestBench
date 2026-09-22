using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Implementation.Controllers;

/// <summary>
/// stream: items.medium's rows written one per line and flushed as each is written. MVC has no
/// result that writes NDJSON, so the action writes to the response itself. The length is never
/// known, so the answer goes out chunked.
/// </summary>
[ApiController]
public sealed class StreamController(Payloads payloads) : ControllerBase
{
    private static readonly byte[] NewLine = "\n"u8.ToArray();

    [HttpGet("/stream/items")]
    public async Task Rows()
    {
        Response.ContentType = "application/x-ndjson";
        foreach (Item row in payloads.Medium.Items)
        {
            await JsonSerializer.SerializeAsync(Response.Body, row, JsonContext.Default.Item);
            await Response.Body.WriteAsync(NewLine);
            await Response.Body.FlushAsync();
        }
    }
}
