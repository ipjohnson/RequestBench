using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On Kestrel, so the headers are the ones the server sends.</summary>
[KestrelRuntime]
public class StreamTests
{
    // rb:test stream.ndjson
    [HardenedTest]
    [Trait("corpus", "stream.ndjson")]
    public async Task Each_row_is_a_line_and_the_length_is_never_sent(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync("/stream/items");

        Assert.Equal("application/x-ndjson", response.Content.Headers.ContentType?.MediaType);
        // The server sends no length, and the body goes out in chunks as it is written.
        Assert.True(response.Headers.TransferEncodingChunked);
        string[] lines = (await response.Content.ReadAsStringAsync()).TrimEnd('\n').Split('\n');
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, lines.Length);
        Assert.All(lines.Zip(rows), pair => Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First))));
    }
}
