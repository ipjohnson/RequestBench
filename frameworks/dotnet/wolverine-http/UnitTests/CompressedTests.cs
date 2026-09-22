using System.IO.Compression;

namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class CompressedTests(WolverineApp app)
{
    // rb:test compressed.gzip_small,compressed.gzip_large
    [Theory]
    [Trait("corpus", "compressed.gzip_small")]
    [Trait("corpus", "compressed.gzip_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Gzip_asked_for_is_gzip_answered_and_the_handler_runs_each_time(string size)
    {
        IScenarioResult first = await Ask($"/compressed/{size}", "gzip");
        IScenarioResult second = await Ask($"/compressed/{size}", "gzip");

        Assert.Equal("gzip", Answer.Header(second, "content-encoding"));
        await using GZipStream unzipped = new(new MemoryStream(Answer.Bytes(second)), CompressionMode.Decompress);
        Assert.True(JsonNode.DeepEquals(Expected.Json($"items.{size}.json"), await JsonNode.ParseAsync(unzipped)));
        Assert.True(Answer.Serial(second) > Answer.Serial(first));
    }

    // rb:test compressed.identity_small,compressed.identity_large
    [Theory]
    [Trait("corpus", "compressed.identity_small")]
    [Trait("corpus", "compressed.identity_large")]
    [InlineData("/compressed/small", "items.small.json")]
    [InlineData("/compressed/large", "items.large.json")]
    public async Task Identity_asked_for_is_answered_as_written(string path, string file)
    {
        IScenarioResult result = await Ask(path, "identity");

        Assert.Null(Answer.Header(result, "content-encoding"));
        Answer.Is(Expected.Json(file), result);
    }

    private Task<IScenarioResult> Ask(string path, string encoding) => app.Host.Scenario(s =>
    {
        s.Get.Url(path);
        s.WithRequestHeader("accept-encoding", encoding);
    });
}
