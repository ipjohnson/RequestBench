using System.Net.ServerSentEvents;

namespace UnitTests;

public sealed class SseTests(CarterApp app) : IClassFixture<CarterApp>
{
    // rb:test sse.medium
    [Fact]
    [Trait("corpus", "sse.medium")]
    public async Task Each_row_is_the_data_of_one_message_event_with_no_id()
    {
        using HttpRequestMessage request = new(HttpMethod.Get, "/sse/medium");
        request.Headers.Accept.ParseAdd("text/event-stream");
        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        // ContentLength would be computed from the buffered body, so read the headers as they arrived.
        Assert.False(response.Content.Headers.NonValidated.Contains("Content-Length"));
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
