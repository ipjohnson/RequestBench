namespace UnitTests;

public sealed class EtagTests(App app) : TestBase<App>
{
    // rb:test etag.small,etag.large
    [Theory]
    [Trait("corpus", "etag.small")]
    [Trait("corpus", "etag.large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task The_answer_carries_a_validator(string size)
    {
        using HttpResponseMessage response = await app.Client.GetAsync($"/etag/{size}", Cancellation);

        Assert.NotNull(response.Headers.ETag);
        await Answer.IsAsync(Expected.Json($"items.{size}.json"), response);
    }

    // rb:test etag.match_large
    [Fact]
    [Trait("corpus", "etag.match_large")]
    public async Task The_validator_it_issued_is_answered_304_with_no_body()
    {
        using HttpResponseMessage first = await app.Client.GetAsync("/etag/large", Cancellation);

        using HttpResponseMessage second = await ConditionalAsync(first.Headers.ETag!.Tag);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Empty(await Answer.BytesAsync(second));
    }

    // rb:test etag.stale_large
    [Fact]
    [Trait("corpus", "etag.stale_large")]
    public async Task A_validator_it_never_issued_is_answered_in_full()
    {
        using HttpResponseMessage response = await ConditionalAsync((string)Expected.Settings["staleEtag"]!);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Answer.IsAsync(Expected.Json("items.large.json"), response);
    }

    private Task<HttpResponseMessage> ConditionalAsync(string tag)
    {
        HttpRequestMessage request = new(HttpMethod.Get, "/etag/large");
        request.Headers.TryAddWithoutValidation("if-none-match", tag);
        return app.Client.SendAsync(request, Cancellation);
    }
}
