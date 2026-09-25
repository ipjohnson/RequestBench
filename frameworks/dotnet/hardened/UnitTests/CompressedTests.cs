namespace UnitTests;

public class CompressedTests
{
    // rb:test compressed.gzip_small,compressed.gzip_large
    [ModuleTest]
    [Trait("corpus", "compressed.gzip_small")]
    [Trait("corpus", "compressed.gzip_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Gzip_is_used_when_asked_for(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/compressed/{size}", request => request.Headers["Accept-Encoding"] = "gzip");

        Assert.Equal("gzip", Answer.Header(response, "Content-Encoding"));
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }

    // rb:test compressed.identity_small,compressed.identity_large
    [ModuleTest]
    [Trait("corpus", "compressed.identity_small")]
    [Trait("corpus", "compressed.identity_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Identity_is_left_uncompressed(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/compressed/{size}", request => request.Headers["Accept-Encoding"] = "identity");

        Assert.Null(Answer.Header(response, "Content-Encoding"));
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }

    [ModuleTest]
    public async Task A_route_without_the_attribute_is_never_compressed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/json/large", request => request.Headers["Accept-Encoding"] = "gzip");

        Assert.Null(Answer.Header(response, "Content-Encoding"));
    }
}
