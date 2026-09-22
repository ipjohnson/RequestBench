using System.IO.Compression;

namespace UnitTests;

public sealed class CompressedTests(App app) : TestBase<App>
{
    // rb:test compressed.gzip_small,compressed.gzip_large
    [Theory]
    [Trait("corpus", "compressed.gzip_small")]
    [Trait("corpus", "compressed.gzip_large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task Gzip_asked_for_is_gzip_answered_and_the_handler_runs_each_time(string size)
    {
        using HttpResponseMessage first = await AskAsync($"/compressed/{size}", "gzip");
        using HttpResponseMessage second = await AskAsync($"/compressed/{size}", "gzip");

        Assert.Equal(["gzip"], second.Content.Headers.ContentEncoding);
        await using GZipStream unzipped = new(await second.Content.ReadAsStreamAsync(Cancellation), CompressionMode.Decompress);
        Assert.True(JsonNode.DeepEquals(Expected.Json($"items.{size}.json"), await JsonNode.ParseAsync(unzipped, cancellationToken: Cancellation)));
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
        using HttpResponseMessage response = await AskAsync(path, "identity");

        Assert.Empty(response.Content.Headers.ContentEncoding);
        await Answer.IsAsync(Expected.Json(file), response);
    }

    private Task<HttpResponseMessage> AskAsync(string path, string encoding)
    {
        HttpRequestMessage request = new(HttpMethod.Get, path);
        request.Headers.Add("accept-encoding", encoding);
        request.Headers.Add("cache-control", "no-cache");
        return app.Client.SendAsync(request, Cancellation);
    }
}
