namespace UnitTests;

public sealed class StreamTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test stream.ndjson
    [Fact]
    [Trait("corpus", "stream.ndjson")]
    public async Task Each_row_is_a_line_and_the_length_is_never_sent()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/stream/items");

        Assert.Equal("application/x-ndjson", response.Content.Headers.ContentType?.MediaType);
        // ContentLength would be computed from the buffered body, so read the headers as they arrived.
        Assert.False(response.Content.Headers.NonValidated.Contains("Content-Length"));
        string[] lines = (await response.Content.ReadAsStringAsync()).TrimEnd('\n').Split('\n');
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, lines.Length);
        Assert.All(lines.Zip(rows), pair => Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First))));
    }
}
