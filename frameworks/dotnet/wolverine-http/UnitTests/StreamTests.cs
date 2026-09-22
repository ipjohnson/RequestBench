namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class StreamTests(WolverineApp app)
{
    // rb:test stream.ndjson
    [Fact]
    [Trait("corpus", "stream.ndjson")]
    public async Task Each_row_is_a_line_and_the_length_is_never_sent()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/stream/items");
            s.ContentTypeShouldBe("application/x-ndjson");
        });

        Assert.Null(result.Context.Response.ContentLength);
        string[] lines = result.ReadAsText().TrimEnd('\n').Split('\n');
        JsonArray rows = Expected.Json("items.medium.json")["items"]!.AsArray();
        Assert.Equal(rows.Count, lines.Length);
        Assert.All(lines.Zip(rows), pair => Assert.True(JsonNode.DeepEquals(pair.Second, JsonNode.Parse(pair.First))));
    }
}
