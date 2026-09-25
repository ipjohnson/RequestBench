using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On a Kestrel socket, so the headers are what the server framed the stream with.</summary>
[KestrelRuntime]
public class StreamTests
{
    // rb:test stream.ndjson
    [ModuleTest]
    [Trait("corpus", "stream.ndjson")]
    public async Task Each_row_is_a_line_and_the_length_is_never_sent(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/stream/items");

        response.Assert.Ok();
        Assert.StartsWith("application/x-ndjson", Answer.Header(response, "Content-Type"));
        Assert.Equal("chunked", Answer.Header(response, "Transfer-Encoding"));
        string[] lines = (await response.ReadTextAsync()).TrimEnd('\n').Split('\n');
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, lines.Length);
        Assert.All(lines.Zip(rows), pair => Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First))));
    }
}
