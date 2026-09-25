using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On a Kestrel socket, so the headers are what the server framed the events with.</summary>
[KestrelRuntime]
public class SseTests
{
    // rb:test sse.medium
    [ModuleTest]
    [Trait("corpus", "sse.medium")]
    public async Task Each_row_is_the_data_of_one_event(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/sse/medium", request => request.Headers["Accept"] = "text/event-stream");

        response.Assert.Ok();
        Assert.StartsWith("text/event-stream", Answer.Header(response, "Content-Type"));
        Assert.Equal("chunked", Answer.Header(response, "Transfer-Encoding"));
        string[] data = [.. (await response.ReadTextAsync()).Split('\n').Where(line => line.StartsWith("data: ", StringComparison.Ordinal)).Select(line => line["data: ".Length..])];
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, data.Length);
        Assert.All(data.Zip(rows), pair => Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First))));
    }
}
