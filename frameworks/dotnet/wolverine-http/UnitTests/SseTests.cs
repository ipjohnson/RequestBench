using System.Net.ServerSentEvents;

namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class SseTests(WolverineApp app)
{
    // rb:test sse.medium
    [Fact]
    [Trait("corpus", "sse.medium")]
    public async Task Each_row_is_the_data_of_one_message_event_with_no_id()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/sse/medium");
            s.WithRequestHeader("accept", "text/event-stream");
            s.ContentTypeShouldBe("text/event-stream");
        });

        Assert.Null(result.Context.Response.ContentLength);
        SseParser<string> parser = SseParser.Create(new MemoryStream(Answer.Bytes(result)));
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
