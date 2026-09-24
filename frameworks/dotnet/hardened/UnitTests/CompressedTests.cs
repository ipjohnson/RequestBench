namespace UnitTests;

public class CompressedTests
{
    // rb:test compressed.gzip_small,compressed.gzip_large
    [HardenedTest]
    [Trait("corpus", "compressed.gzip_small")]
    [Trait("corpus", "compressed.gzip_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Gzip_asked_for_is_gzip_answered_and_the_handler_runs_each_time(string size, ITestWebApp app)
    {
        TestWebResponse first = await app.Get($"/compressed/{size}", request => request.Headers["Accept-Encoding"] = "gzip");
        TestWebResponse second = await app.Get($"/compressed/{size}", request => request.Headers["Accept-Encoding"] = "gzip");

        Assert.Equal("gzip", Answer.Header(second, "content-encoding"));
        await Answer.Is(Expected.Json($"items.{size}.json"), second);
        Assert.True(Answer.Serial(second) > Answer.Serial(first));
    }

    // rb:test compressed.identity_small,compressed.identity_large
    [HardenedTest]
    [Trait("corpus", "compressed.identity_small")]
    [Trait("corpus", "compressed.identity_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Identity_asked_for_is_answered_as_written(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/compressed/{size}", request => request.Headers["Accept-Encoding"] = "identity");

        Assert.Null(Answer.Header(response, "content-encoding"));
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }
}
