using System.Net.ServerSentEvents;
using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On Kestrel, so the headers are the ones the server sends.</summary>
[KestrelRuntime]
public class SseTests
{
    // rb:test sse.medium
    [HardenedTest]
    [Trait("corpus", "sse.medium")]
    public async Task Each_row_is_the_data_of_one_message_event_with_no_id(HttpClient client)
    {
        using HttpRequestMessage request = new(HttpMethod.Get, "/sse/medium");
        request.Headers.Accept.ParseAdd("text/event-stream");
        using HttpResponseMessage response = await client.SendAsync(request);

        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        // The server sends no length, and the body goes out in chunks as it is written.
        Assert.True(response.Headers.TransferEncodingChunked);
        SseParser<string> parser = SseParser.Create(await response.Content.ReadAsStreamAsync());
        List<SseItem<string>> events = [];
        await foreach (SseItem<string> item in parser.EnumerateAsync())
        {
            events.Add(item);
        }
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, events.Count);
        Assert.All(events.Zip(rows), pair =>
        {
            Assert.Equal("message", pair.First.EventType);
            Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First.Data)));
        });
        // The parser keeps the last id it read across events, so this is empty only if no event carried one.
        Assert.Empty(parser.LastEventId);
    }
}
